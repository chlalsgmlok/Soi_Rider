import { describe, expect, it } from 'vitest';
import type { SaveData } from '../core/types';
import { createDefaultSave } from '../logic/save-defaults';
import { memoryStore } from '../logic/storage';
import { Leaderboard } from './leaderboard';
import { leaderboardConfig } from './leaderboard-config';
import { PlayerIdentity } from './player-identity';
import { authHeaders, type BoardRow, countFrom, type Fetcher, SupabaseBoard } from './supabase-board';

const ME = '11111111-2222-4333-a444-555555555555';
const CFG = { url: 'https://demo.supabase.co', key: 'anon-key' };

/** an in-memory PostgREST stand-in for public.soi_scores + rpc/submit_score */
function fakeServer(rows: BoardRow[]): { fetcher: Fetcher; calls: { method: string; path: string; apikey: string }[]; fail: (on: boolean) => void } {
  const calls: { method: string; path: string; apikey: string }[] = [];
  let failing = false;
  const fetcher: Fetcher = async (input, init) => {
    const url = new URL(input);
    const headers = new Headers(init?.headers);
    calls.push({ method: init?.method ?? 'GET', path: url.pathname, apikey: headers.get('apikey') ?? '' });
    if (failing) return new Response('down', { status: 503 });
    if (url.pathname === '/rest/v1/rpc/submit_score') {
      const b = JSON.parse(String(init?.body)) as { p_player: string; p_nickname: string; p_score: number; p_grade: string };
      const old = rows.find((r) => r.player_id === b.p_player);
      if (!old) rows.push({ player_id: b.p_player, nickname: b.p_nickname, score: b.p_score, grade: b.p_grade, updated_at: '2026-10-09' });
      else if (b.p_score > old.score) Object.assign(old, { score: b.p_score, grade: b.p_grade, nickname: b.p_nickname });
      return new Response(null, { status: 204 });
    }
    const gt = url.searchParams.get('score');
    const hit = gt ? rows.filter((r) => r.score > Number(gt.slice(3))) : rows;
    if (headers.get('prefer') === 'count=exact') return new Response('[]', { headers: { 'content-range': hit.length ? `0-0/${hit.length}` : '*/0' } });
    const sorted = [...rows].sort((a, b) => b.score - a.score).slice(0, Number(url.searchParams.get('limit')));
    return new Response(JSON.stringify(sorted), { headers: { 'content-type': 'application/json' } });
  };
  return { fetcher, calls, fail: (on) => { failing = on; } };
}

const row = (player_id: string, nickname: string, score: number, grade = 'A'): BoardRow => ({ player_id, nickname, score, grade, updated_at: '2026-10-01' });
const saveWith = (bestScore: number): SaveData => {
  const s = createDefaultSave();
  return { ...s, bestScore, loadout: { ...s.loadout, nickname: 'NONG' } };
};
const identity = (): PlayerIdentity => new PlayerIdentity(memoryStore({ 'soi-rider:player-id': ME }));

describe('leaderboard config', () => {
  it('needs both the URL and the anon key; trims a trailing slash', () => {
    expect(leaderboardConfig({})).toBeNull();
    expect(leaderboardConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: ' ' })).toBeNull();
    expect(leaderboardConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'https://x.supabase.co', key: 'k' });
  });

  it('sends legacy anon JWTs as Bearer too, new publishable keys only as apikey', () => {
    expect(authHeaders('eyJhbGciOi.x.y')).toEqual({ apikey: 'eyJhbGciOi.x.y', Authorization: 'Bearer eyJhbGciOi.x.y' });
    expect(authHeaders('sb_publishable_abc')).toEqual({ apikey: 'sb_publishable_abc' });
  });

  it('reads PostgREST counts from Content-Range', () => {
    expect(countFrom('0-0/42')).toBe(42);
    expect(countFrom('*/0')).toBe(0);
    expect(countFrom('0-0/*')).toBe(0);
    expect(countFrom(null)).toBe(0);
  });
});

describe('Leaderboard', () => {
  it('offline (no server configured) shows only my record', async () => {
    const view = await new Leaderboard(null, identity()).view(saveWith(1234));
    expect(view.status).toBe('offline');
    expect(view.entries).toEqual([]);
    expect(view.mine).toMatchObject({ rank: null, nickname: 'NONG', score: 1234 });
    expect(view.message).toBeTruthy();
    expect(await new Leaderboard(null, identity()).sync(saveWith(1234))).toBeNull();
  });

  it('uploads the best once, ranks it, and marks my row', async () => {
    const server = fakeServer([row('a', 'TUK', 3000, 'S'), row('b', 'BEE', 900, 'C')]);
    const lb = new Leaderboard(new SupabaseBoard(CFG, server.fetcher), identity());
    expect(await lb.sync(saveWith(1500))).toBe(2);
    expect(server.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(server.calls.every((c) => c.apikey === CFG.key)).toBe(true);
    expect(await lb.sync(saveWith(1500))).toBeNull(); // nothing new: no second upload
    const view = await lb.view(saveWith(1500));
    expect(server.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(view.status).toBe('online');
    expect(view.entries.map((e) => [e.rank, e.nickname, e.me])).toEqual([[1, 'TUK', false], [2, 'NONG', true], [3, 'BEE', false]]);
    expect(view.mine).toMatchObject({ rank: 2, score: 1500 });
    expect(view.total).toBe(3);
  });

  it('a better run replaces the old record; a worse one is never sent', async () => {
    const server = fakeServer([row('a', 'TUK', 3000)]);
    const lb = new Leaderboard(new SupabaseBoard(CFG, server.fetcher), identity());
    await lb.sync(saveWith(1000));
    expect(await lb.sync(saveWith(3500))).toBe(1);
    expect(server.calls.filter((c) => c.method === 'POST')).toHaveLength(2);
    const view = await lb.view(saveWith(3500));
    expect(view.entries[0]).toMatchObject({ rank: 1, nickname: 'NONG', score: 3500, me: true });
    expect(view.entries).toHaveLength(2);
  });

  it('ties share a rank', async () => {
    const server = fakeServer([row('a', 'A', 2000), row('b', 'B', 2000), row('c', 'C', 500)]);
    const view = await new Leaderboard(new SupabaseBoard(CFG, server.fetcher), identity()).view(saveWith(0));
    expect(view.entries.map((e) => e.rank)).toEqual([1, 1, 3]);
    expect(view.mine).toMatchObject({ rank: null, grade: null }); // no record yet
  });

  it('a failing server turns into the error state, not a crash', async () => {
    const server = fakeServer([row('a', 'A', 2000)]);
    server.fail(true);
    const view = await new Leaderboard(new SupabaseBoard(CFG, server.fetcher), identity()).view(saveWith(800));
    expect(view.status).toBe('error');
    expect(view.mine.score).toBe(800);
    expect(view.message).toBeTruthy();
  });
});

describe('PlayerIdentity', () => {
  it('creates one stable anonymous id per device and remembers the synced best', () => {
    const store = memoryStore();
    const a = new PlayerIdentity(store);
    const id = a.id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new PlayerIdentity(store).id).toBe(id);
    a.markSynced(1200);
    a.markSynced(900);
    expect(new PlayerIdentity(store).synced()).toBe(1200);
  });
});
