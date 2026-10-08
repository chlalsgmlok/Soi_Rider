import { describe, expect, it } from 'vitest';
import type { WeatherEvent } from '../../core/types';
import { createDownpourLevels, downpourAt, downpourSec, DOWNPOUR_SHAPE, hazeSpikeAt } from './envelopes';
import { stepWashout, stepWetness, wetTarget } from './rain-aftermath';
import { flashAt, strikePower, THUNDER } from './thunder-clock';

const run = (w: number, rain: number, sun: number, sec: number, step: (w: number, r: number, s: number, dt: number) => number): number => {
  let v = w;
  for (let i = 0; i < sec * 60; i++) v = step(v, rain, sun, 1 / 60);
  return v;
};

describe('rain aftermath', () => {
  it('wets fast under heavy rain, holds while it drizzles, dries slower at night', () => {
    expect(run(0, 1, 1, 6, stepWetness)).toBeGreaterThan(0.85);
    expect(run(1, 0.08, 1, 60, stepWetness)).toBeGreaterThan(wetTarget(0.08));
    const day = run(1, 0, 1, 60, stepWetness);
    const night = run(1, 0, 0, 60, stepWetness);
    expect(day).toBeLessThan(night);
    expect(day).toBeGreaterThan(0.2);
    expect(run(1, 0, 1, 400, stepWetness)).toBe(0);
  });

  it('washes smog out while it rains and lets it creep back', () => {
    const washed = run(0, 1, 0, 10, (w, r, _s, dt) => stepWashout(w, r, dt));
    expect(washed).toBeGreaterThan(0.9);
    const later = run(washed, 0, 0, 40, (w, r, _s, dt) => stepWashout(w, r, dt));
    expect(later).toBeLessThan(washed);
    expect(later).toBeGreaterThan(0);
  });
});

describe('envelopes', () => {
  const ev: WeatherEvent = { kind: 'downpour', atProgress: 0, duration: 5, intensity: 1 };

  it('stretches a too-short downpour so build-up, rain and taper all fit', () => {
    expect(downpourSec(ev)).toBeGreaterThanOrEqual(DOWNPOUR_SHAPE.fullAt + DOWNPOUR_SHAPE.taperMin);
    const lv = createDownpourLevels();
    expect(downpourAt(DOWNPOUR_SHAPE.fullAt, ev, lv).rain).toBeGreaterThan(0.5);
    expect(downpourAt(-1, ev, lv).phase).toBe('calm');
    expect(downpourAt(downpourSec(ev) + 1, ev, lv).phase).toBe('after');
  });

  it('shapes a smog spike: zero outside, intensity-capped inside', () => {
    const spike: WeatherEvent = { kind: 'haze_spike', atProgress: 0, duration: 40, intensity: 0.6 };
    expect(hazeSpikeAt(-1, spike)).toBe(0);
    expect(hazeSpikeAt(41, spike)).toBe(0);
    expect(hazeSpikeAt(20, spike)).toBeCloseTo(0.6, 5);
  });

  it('lightning flickers within 0..1 and near strikes are brighter', () => {
    for (let t = -0.1; t < THUNDER.flashSec + 0.2; t += 0.01) {
      expect(flashAt(t)).toBeGreaterThanOrEqual(0);
      expect(flashAt(t)).toBeLessThanOrEqual(1);
    }
    expect(flashAt(0)).toBe(1);
    expect(strikePower(0.6)).toBeGreaterThan(strikePower(5));
  });
});
