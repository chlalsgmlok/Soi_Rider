import { type LeaderboardConfig, REQUEST_TIMEOUT } from './leaderboard-config';

/** one row of public.soi_scores (docs/leaderboard-setup.md) */
export interface BoardRow {
  player_id: string;
  nickname: string;
  score: number;
  grade: string;
  updated_at: string;
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** total from a PostgREST `Content-Range: 0-0/123` (or `*\/0`) header */
export function countFrom(range: string | null): number {
  const total = range?.split('/')[1];
  const n = total === undefined || total === '*' ? NaN : Number(total);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Thin REST client for the Supabase ranking: read the top rows and counts through PostgREST, write only through
 * the `submit_score` function (it keeps each rider's best). Every call times out after REQUEST_TIMEOUT.
 */
export class SupabaseBoard {
  constructor(private readonly cfg: LeaderboardConfig, private readonly fetcher: Fetcher = (i, r) => fetch(i, r)) {}

  async top(limit: number): Promise<BoardRow[]> {
    const q = `select=player_id,nickname,score,grade,updated_at&order=score.desc,updated_at.asc&limit=${limit}`;
    const res = await this.call(`/rest/v1/soi_scores?${q}`);
    const rows: unknown = await res.json();
    return Array.isArray(rows) ? rows.filter(isRow) : [];
  }

  /** riders with a strictly higher best + 1, and how many riders are on the board */
  async rankOf(score: number): Promise<{ rank: number; total: number }> {
    const head = { Prefer: 'count=exact', Range: '0-0' };
    const [above, all] = await Promise.all([
      this.call(`/rest/v1/soi_scores?select=player_id&score=gt.${Math.round(score)}`, { headers: head }),
      this.call('/rest/v1/soi_scores?select=player_id', { headers: head }),
    ]);
    return { rank: countFrom(above.headers.get('content-range')) + 1, total: countFrom(all.headers.get('content-range')) };
  }

  async submit(playerId: string, nickname: string, score: number, grade: string): Promise<void> {
    await this.call('/rest/v1/rpc/submit_score', {
      method: 'POST',
      body: JSON.stringify({ p_player: playerId, p_nickname: nickname, p_score: Math.round(score), p_grade: grade }),
    });
  }

  private async call(path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<Response> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT);
    try {
      const res = await this.fetcher(`${this.cfg.url}${path}`, {
        method: init.method ?? 'GET',
        body: init.body,
        signal: abort.signal,
        headers: { ...authHeaders(this.cfg.key), 'Content-Type': 'application/json', ...init.headers },
      });
      if (!res.ok) throw new Error(`ranking request failed: ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** legacy anon keys are JWTs (also sent as Bearer); the newer sb_publishable_ keys are not and go in `apikey` only */
export function authHeaders(key: string): Record<string, string> {
  return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

function isRow(r: unknown): r is BoardRow {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return typeof o.player_id === 'string' && typeof o.nickname === 'string' && typeof o.score === 'number' && typeof o.grade === 'string';
}
