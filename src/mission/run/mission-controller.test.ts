import { describe, expect, it } from 'vitest';
import { BIKES } from '../../core/config/bikes';
import { STARTER_LOADOUT } from '../../core/config/catalog';
import { COMFORT } from '../../core/config/scoring';
import { EventBus, type GameEvents } from '../../core/events';
import type { JobOffer, PassengerTrait, PlayerState, RunConfig } from '../../core/types';
import { createPlayerState } from '../../player/ride-env';
import { createCityQuery } from '../../world/city-query';
import { city } from '../../world/gen/test-fixtures';
import { MissionController } from './mission-controller';
import type { MissionFrame, MissionHooks } from './mission-types';
import { BOARD_SEC, DROP_SEC, STOP_HOLD } from './phase-flow';
import { PROMPT_WINDOW } from './story-prompts';

const DT = 1 / 60;
const data = city(7, 'sukhumvit');
const query = createCityQuery(data);
const others = data.pois.filter((p) => p.id !== data.spawn.poi);
const far = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);
const pickup = others.find((p) => far(p.pos, data.spawn.pos) > 120) ?? others[0];
const drop = others.find((p) => p.id !== pickup.id && far(p.pos, pickup.pos) > 250) ?? others[1];

function setup(trait: PassengerTrait = 'regular', hooks: MissionHooks = {}) {
  const config: RunConfig = {
    seed: 7, tripNumber: 3, intensity: 'rush', timeOfDay: 'sunset', district: 'sukhumvit', loadout: { ...STARTER_LOADOUT },
    weather: { base: 'clear', haze: 0.1, events: [] },
  };
  const job: JobOffer = {
    id: 'job', pickupPoi: pickup.id, dropPoi: drop.id, estMeters: 500, approachMeters: 200, fareBaht: 90, note: '',
    passenger: { id: 'p', name: '말리 (Mali)', origin: '방콕 직장인', trait, rating: 4.8,
      look: { skin: '#D9A47A', shirt: '#F2559A', pants: '#2B3A5C', hair: 'hair_long', hairColor: '#1E1B1A' } },
  };
  const bus = new EventBus();
  const log: Array<[keyof GameEvents, unknown]> = [];
  for (const k of ['mission:phase', 'story:prompt', 'story:resolve', 'comfort:delta', 'passenger:say', 'redLight', 'toast'] as const) {
    bus.on(k, (e) => log.push([k, e]));
  }
  const m = new MissionController({ city: query, config, job, bus, hooks });
  const player: PlayerState = createPlayerState(BIKES.cub);
  player.pos = { ...data.spawn.pos };
  player.heading = data.spawn.heading;
  const frame: MissionFrame = { player, interact: false, contacts: [], style: [], weather: { rain: 0, haze: 0.1 }, traffic: null };
  const step = (sec: number, edit?: (f: MissionFrame) => void): void => {
    for (let i = 0; i < Math.round(sec / DT); i++) {
      edit?.(frame);
      m.update(DT, frame);
    }
  };
  const park = (p: { pos: { x: number; z: number }; heading: number }): void => {
    player.pos = { x: p.pos.x, z: p.pos.z };
    player.heading = p.heading;
    player.speed = 0;
  };
  const phases = (): string[] => log.filter(([k]) => k === 'mission:phase').map(([, e]) => (e as { phase: string }).phase);
  return { m, bus, log, player, frame, step, park, phases };
}

/** start → stop at the pickup → boarded */
function board(t: ReturnType<typeof setup>): void {
  t.m.start();
  t.park(pickup);
  t.step(STOP_HOLD + BOARD_SEC + 0.2);
}

describe('MissionController', () => {
  it('runs a full job: pickup stop → boarding → dropoff stop → complete, with a RunResult', () => {
    const calls: string[] = [];
    const t = setup('regular', {
      board: (p, s) => void calls.push(`board:${p.name}:${s}`),
      dismount: (_p, s) => void calls.push(`dismount:${s}`),
      ended: (ph) => void calls.push(`ended:${ph}`),
    });
    expect(t.m.phase).toBe('intro');
    expect(t.m.stats.etaSec).toBeGreaterThan(0);
    board(t);
    expect(t.m.phase).toBe('toDropoff');
    expect(t.m.nav.path?.end).toEqual(drop.pos);
    t.park(drop);
    t.step(STOP_HOLD + DROP_SEC + 0.2);
    expect(t.phases()).toEqual(['toPickup', 'boarding', 'toDropoff', 'arriving', 'complete']);
    expect(calls).toEqual([`board:말리 (Mali):${BOARD_SEC}`, `dismount:${DROP_SEC}`, 'ended:complete']);
    const r = t.m.result(0);
    expect(r.stats.failed).toBeNull();
    expect(r.grade).not.toBe('F');
    expect(r.totalBaht).toBeGreaterThan(0);
    const said = t.log.filter(([k]) => k === 'passenger:say').length;
    expect(said).toBeGreaterThanOrEqual(3);
  });

  it('fails after the third fall', () => {
    const t = setup();
    t.m.start();
    for (let i = 0; i < 3; i++) {
      t.step(0.2, (f) => (f.player.fallen = true));
      t.step(0.2, (f) => (f.player.fallen = false));
    }
    expect(t.m.phase).toBe('failed');
    expect(t.m.result().stats.failed).toBe('falls');
    expect(t.m.result().grade).toBe('F');
  });

  it('fails on timeout at 2.5 × ETA', () => {
    const t = setup();
    t.m.start();
    t.step(t.m.stats.etaSec * COMFORT.timeoutFactor - 1);
    expect(t.m.phase).toBe('toPickup');
    t.step(2);
    expect(t.m.phase).toBe('failed');
    expect(t.m.stats.failed).toBe('timeout');
  });

  it('fails when comfort hits 0 and lets the passenger off', () => {
    let off = 0;
    const t = setup('nervous', { dismount: () => void off++ });
    board(t);
    // a different vehicle every step (one continuous rub on the same car only counts once)
    let id = 0;
    const hit = () => ({ kind: 'body' as const, heavy: false, speedKmh: 12, point: { x: 0, z: 0 }, otherId: ++id, key: id, other: `taxi#${id}` });
    t.step(1, (f) => (f.contacts = [hit()]));
    expect(t.m.phase).toBe('failed');
    expect(t.m.stats.failed).toBe('comfort');
    expect(off).toBe(1);
  });

  it('lets queue scrapes (< 4 km/h) go free and counts one continuous rub on the same car once', () => {
    const t = setup('nervous');
    board(t);
    const start = t.m.comfort.value;
    const touch = (speedKmh: number, otherId: number) =>
      ({ kind: 'body' as const, heavy: false, speedKmh, point: { x: 0, z: 0 }, otherId, key: otherId, other: `van#${otherId}` });
    t.step(2, (f) => (f.contacts = [touch(0.3, 7)]));
    expect(t.m.stats.bumps).toBe(0);
    expect(t.m.comfort.value).toBeGreaterThanOrEqual(start);
    t.step(1, (f) => (f.contacts = [touch(9, 7)]));
    expect(t.m.stats.bumps).toBe(1);
    t.frame.contacts = [];
    t.step(2);
    t.step(DT, (f) => (f.contacts = [touch(9, 7)]));
    expect(t.m.stats.bumps).toBe(2);
  });

  it('offers the raincoat on a downpour; stop + E hands it over (+comfort, care, story:resolve)', () => {
    const care: Array<[boolean, boolean]> = [];
    const t = setup('tourist', { care: (p, m) => void care.push([p, m]) });
    board(t);
    const before = t.m.comfort.value;
    t.step(0.5, (f) => (f.weather = { rain: 0.9, haze: 0.1 }));
    expect(t.log.some(([k, e]) => k === 'story:prompt' && (e as { id: string }).id === 'raincoat')).toBe(true);
    t.step(DT, (f) => (f.interact = true));
    t.frame.interact = false;
    expect(t.log.some(([k, e]) => k === 'story:resolve' && (e as { success: boolean }).success)).toBe(true);
    expect(care).toEqual([[true, false]]);
    expect(t.m.stats.raincoat).toBe('given');
    expect(t.m.comfort.value).toBeGreaterThan(before);
  });

  it('records a missed raincoat when the 8 s window runs out', () => {
    const t = setup();
    board(t);
    t.step(PROMPT_WINDOW + 0.5, (f) => (f.weather = { rain: 1, haze: 0.1, downpour: true }));
    expect(t.log.some(([k, e]) => k === 'story:resolve' && !(e as { success: boolean }).success)).toBe(true);
    expect(t.m.stats.raincoat).toBe('missed');
  });

  it('fills the mission HUD fields', () => {
    const t = setup('hurry');
    t.m.start();
    t.step(0.1);
    const hud = t.m.hud();
    expect(hud.phase).toBe('toPickup');
    expect(hud.targetMeters).toBeGreaterThan(0);
    expect(hud.minimap.route.length).toBeGreaterThan(1);
    expect(hud.minimap.target).toEqual(pickup.pos);
    expect(Math.abs(hud.targetBearing)).toBeLessThanOrEqual(Math.PI);
    expect(hud.passenger?.trait).toBe('hurry');
    expect(hud.etaLeftSec).toBeCloseTo(t.m.stats.etaSec - 0.1, 1);
  });
});
