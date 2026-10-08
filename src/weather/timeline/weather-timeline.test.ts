import { describe, expect, it } from 'vitest';
import { EventBus, type GameEvents } from '../../core/events';
import { Rng } from '../../core/rng';
import type { WeatherEvent, WeatherPlan } from '../../core/types';
import type { WeatherState } from '../types';
import { DOWNPOUR_SHAPE, taperSec } from './envelopes';
import { BASE_LEVELS, WeatherTimeline } from './weather-timeline';

const downpour = (atProgress: number, duration = 80, intensity = 0.9): WeatherEvent =>
  ({ kind: 'downpour', atProgress, duration, intensity });
const spike = (atProgress: number, duration = 40, intensity = 0.8): WeatherEvent =>
  ({ kind: 'haze_spike', atProgress, duration, intensity });

function setup(plan: WeatherPlan, seed = 7) {
  const bus = new EventBus();
  const changes: GameEvents['weather:change'][] = [];
  const thunder: Array<{ distance: number; at: number }> = [];
  const tl = new WeatherTimeline(plan, new Rng(seed), bus);
  bus.on('weather:change', (p) => changes.push(p));
  bus.on('thunder', (p) => thunder.push({ distance: p.distance, at: tl.time }));
  return { tl, changes, thunder };
}

/** advance `sec` seconds in 1/60 steps at a fixed progress */
function run(tl: WeatherTimeline, sec: number, progress: number, daylight = 1): void {
  for (let i = 0, n = Math.round(sec * 60); i < n; i++) tl.update(1 / 60, progress, daylight);
}

const NUMS = ['overcast', 'rain', 'gloom', 'haze', 'wetness', 'wind', 'lightning'] as const satisfies readonly (keyof WeatherState)[];

describe('WeatherTimeline sequencing', () => {
  it('starts an event only once the trip progress reaches atProgress', () => {
    const { tl, changes } = setup({ base: 'clear', haze: 0.1, events: [downpour(0.4)] });
    run(tl, 20, 0.39);
    expect(tl.state.kind).toBe('clear');
    expect(tl.state.phase).toBe('calm');
    expect(tl.state.rain).toBe(0);
    expect(changes).toHaveLength(0);
    run(tl, 1 / 60, 0.4);
    expect(tl.state.phase).toBe('buildup');
    expect(tl.state.kind).toBe('rain');
    expect(changes).toEqual([{ from: 'clear', to: 'rain', rain: 0.9 }]);
    expect(tl.upcoming).toHaveLength(0);
  });

  it('builds up for 6 s (dark sky, gust front, first drops) before the full rain', () => {
    const { tl } = setup({ base: 'clear', haze: 0.1, events: [downpour(0, 80, 0.9)] });
    run(tl, 3.5, 0.5);
    expect(tl.state.phase).toBe('buildup');
    expect(tl.state.overcast).toBeGreaterThan(0.5);
    expect(tl.state.rain).toBeGreaterThan(0.01);
    expect(tl.state.rain).toBeLessThan(0.1);
    expect(tl.state.wind).toBeGreaterThan(0.5);
    // the light turns stormy before the heavy rain arrives
    expect(tl.state.gloom).toBeGreaterThan(0.5);
    run(tl, DOWNPOUR_SHAPE.buildup - 3.5 + 0.1, 0.5);
    expect(tl.state.phase).toBe('downpour');
    run(tl, 2, 0.5);
    expect(tl.state.rain).toBeCloseTo(0.9, 2);
    expect(tl.state.overcast).toBeCloseTo(DOWNPOUR_SHAPE.deck, 5);
    expect(tl.state.gloom).toBeGreaterThanOrEqual(tl.state.rain);
  });

  it('tapers before the duration ends, then hands back to the base weather and dries slowly', () => {
    const { tl, changes } = setup({ base: 'overcast', haze: 0.2, events: [downpour(0, 80, 1)] });
    const taperStart = 80 - taperSec(80);
    run(tl, taperStart + 3, 1);
    expect(tl.state.phase).toBe('taper');
    expect(tl.state.rain).toBeLessThan(1);
    expect(tl.state.rain).toBeGreaterThan(0.3);
    run(tl, 80 - (taperStart + 3) + 0.05, 1);
    expect(tl.state.phase).toBe('after');
    expect(tl.state.kind).toBe('overcast');
    expect(tl.state.rain).toBe(0);
    expect(changes.map((c) => `${c.from}>${c.to}`)).toEqual(['overcast>rain', 'rain>overcast']);
    expect(tl.state.wetness).toBeGreaterThan(0.9);
    run(tl, 30, 1);
    expect(tl.state.wetness).toBeGreaterThan(0.45);
    run(tl, DOWNPOUR_SHAPE.lift, 1);
    expect(tl.state.phase).toBe('calm');
    expect(tl.state.overcast).toBeCloseTo(BASE_LEVELS.overcast.overcast, 5);
    run(tl, 300, 1);
    expect(tl.state.wetness).toBeLessThan(0.02);
  });

  it('roads get wet within seconds of heavy rain and dry slower at night', () => {
    const day = setup({ base: 'clear', haze: 0.05, events: [downpour(0, 60, 1)] });
    const night = setup({ base: 'clear', haze: 0.05, events: [downpour(0, 60, 1)] });
    run(day.tl, 12, 0, 1);
    run(night.tl, 12, 0, 0);
    expect(day.tl.state.wetness).toBeGreaterThan(0.85);
    run(day.tl, 48 + 40, 0, 1);
    run(night.tl, 48 + 40, 0, 0);
    expect(night.tl.state.wetness).toBeGreaterThan(day.tl.state.wetness + 0.1);
  });

  it('a smog spike ramps up, holds and fades; rain washes smog out', () => {
    const { tl, changes } = setup({ base: 'clear', haze: 0.1, events: [spike(0.2, 40, 1)] });
    run(tl, 1, 0.25);
    expect(tl.state.phase).toBe('smog');
    expect(tl.state.kind).toBe('haze');
    run(tl, 10, 0.25);
    expect(tl.state.haze).toBeGreaterThan(0.85);
    run(tl, 31, 0.25);
    expect(tl.state.phase).toBe('calm');
    expect(tl.state.haze).toBeCloseTo(0.1, 5);
    expect(changes.map((c) => `${c.from}>${c.to}`)).toEqual(['clear>haze', 'haze>clear']);

    const wet = setup({ base: 'haze', haze: 0.6, events: [downpour(0, 90, 1)] });
    run(wet.tl, 20, 0);
    expect(wet.tl.state.haze).toBeLessThan(0.6 * 0.55);
  });

  it('announces a spike on an already hazy day (from === to)', () => {
    const { tl, changes } = setup({ base: 'haze', haze: 0.55, events: [spike(0.1)] });
    run(tl, 2, 0.5);
    expect(changes).toEqual([{ from: 'haze', to: 'haze', rain: 0 }]);
  });

  it('thunders during the build-up and keeps striking in a storm', () => {
    const { tl, thunder } = setup({ base: 'clear', haze: 0.1, events: [downpour(0, 120, 1)] });
    run(tl, 3, 0);
    expect(thunder.length).toBe(1);
    expect(thunder[0].at).toBeLessThan(2.5);
    expect(tl.state.lightning).toBeGreaterThanOrEqual(0);
    run(tl, 90, 0);
    expect(thunder.length).toBeGreaterThan(5);
    for (const t of thunder) expect(t.distance).toBeGreaterThanOrEqual(0.6), expect(t.distance).toBeLessThanOrEqual(6);
  });

  it('trigger() starts an event now and ignores a duplicate while it runs', () => {
    const { tl, changes } = setup({ base: 'clear', haze: 0.1, events: [] });
    expect(tl.trigger('downpour', 60, 0.8)).toBe(true);
    expect(tl.trigger('downpour', 60, 0.8)).toBe(false);
    run(tl, 1, 0);
    expect(tl.state.kind).toBe('rain');
    expect(changes[0]).toEqual({ from: 'clear', to: 'rain', rain: 0.8 });
  });
});

describe('WeatherTimeline state', () => {
  it('keeps every value in 0..1 through overlapping events and ragged frame times', () => {
    const { tl } = setup({ base: 'haze', haze: 0.7, events: [spike(0.1, 50, 1), downpour(0.2, 120, 1), spike(0.3, 30, 1)] });
    const rng = new Rng(3);
    for (let i = 0; i < 6000; i++) {
      tl.update(rng.range(0.001, 0.1), i / 3000, rng.next());
      for (const k of NUMS) {
        expect(Number.isFinite(tl.state[k])).toBe(true);
        expect(tl.state[k]).toBeGreaterThanOrEqual(0);
        expect(tl.state[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic for a seed', () => {
    const plan: WeatherPlan = { base: 'clear', haze: 0.1, events: [downpour(0.1, 70, 0.95)] };
    const a = setup(plan, 11);
    const b = setup(plan, 11);
    for (let i = 0; i < 3000; i++) {
      a.tl.update(1 / 60, i / 2000);
      b.tl.update(1 / 60, i / 2000);
    }
    expect(a.tl.state).toEqual(b.tl.state);
    expect(a.thunder).toEqual(b.thunder);
  });
});
