import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { TimeOfDay, TrafficIntensity, WeatherPlan } from '../core/types';
import { DISTRICT_LABEL, forecastForIntensity, forecastSummary, rerollForecast, rollForecast } from './forecast';
import { DOWNPOUR_CHANCE, EVENT_SPACING, finalizeWeather } from './weather-plan';

describe('rollForecast', () => {
  it('is deterministic for (seed, trip) and changes with either', () => {
    expect(rollForecast(123, 4, 1)).toEqual(rollForecast(123, 4, 1));
    const variety = new Set<string>();
    for (let seed = 0; seed < 40; seed++) variety.add(JSON.stringify(rollForecast(seed, 4, 1)));
    expect(variety.size).toBe(40);
    expect(rollForecast(5, 4)).not.toEqual(rollForecast(5, 5));
  });

  it('trip 1 always starts in Sukhumvit; later trips visit every district', () => {
    const later = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const f = rollForecast(seed, 1);
      expect(f.district).toBe('sukhumvit');
      expect(f.districtLabel).toBe('수쿰빗');
      later.add(rollForecast(seed, 7).district);
    }
    expect([...later].sort()).toEqual(Object.keys(DISTRICT_LABEL).sort());
  });

  it('time of day follows 20 / 25 / 35 / 20 %', () => {
    const n = 8000;
    const count: Record<TimeOfDay, number> = { morning: 0, noon: 0, sunset: 0, night: 0 };
    for (let seed = 0; seed < n; seed++) count[rollForecast(seed * 7919 + 13, 3).timeOfDay] += 1;
    expect(count.morning / n).toBeCloseTo(0.2, 1);
    expect(Math.abs(count.morning / n - 0.2)).toBeLessThan(0.025);
    expect(Math.abs(count.noon / n - 0.25)).toBeLessThan(0.025);
    expect(Math.abs(count.sunset / n - 0.35)).toBeLessThan(0.025);
    expect(Math.abs(count.night / n - 0.2)).toBeLessThan(0.025);
  });

  it('rolls base weather with a matching haze density and no events yet', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 500; seed++) {
      const { weather } = rollForecast(seed, 2);
      seen.add(weather.base);
      expect(weather.events).toEqual([]);
      const [lo, hi] = weather.base === 'haze' ? [0.45, 0.75] : weather.base === 'overcast' ? [0.15, 0.3] : [0.04, 0.14];
      expect(weather.haze).toBeGreaterThanOrEqual(lo);
      expect(weather.haze).toBeLessThanOrEqual(hi);
    }
    expect([...seen].sort()).toEqual(['clear', 'haze', 'overcast']);
  });

  it('writes a Korean one-line summary and clamps rerolls', () => {
    const clear: WeatherPlan = { base: 'clear', haze: 0.1, events: [] };
    expect(forecastSummary('sunset', clear, 'rush')).toBe('노을 · 맑음, 오후 늦게 소나기 가능성 45%');
    expect(forecastSummary('noon', clear, 'light')).toBe('한낮 · 쨍한 하늘 · 폭염 주의, 오후 소나기 가능성 35%');
    expect(forecastSummary('morning', { ...clear, base: 'haze' }, 'gridlock')).toBe('아침 · 연무 · 미세먼지 나쁨, 출근길 소나기 가능성 50%');
    const f = rollForecast(77, 2, 1, 'gridlock');
    expect(f.summary).toBe(forecastSummary(f.timeOfDay, f.weather, 'gridlock'));
    expect(rollForecast(77, 2, -3).rerollsLeft).toBe(0);
    expect(rollForecast(77, 2).rerollsLeft).toBe(1);
  });

  it('forecastForIntensity rewrites only the rain chance of the summary', () => {
    const rush = rollForecast(5, 2);
    expect(rush.summary).toMatch(/가능성 45%$/);
    const light = forecastForIntensity(rush, 'light');
    expect(light.summary).toBe(rush.summary.replace('45%', '35%'));
    expect(forecastForIntensity(rush, 'gridlock').summary).toBe(rush.summary.replace('45%', '50%'));
    expect({ ...light, summary: rush.summary }).toEqual(rush);
    expect(rush.summary).toMatch(/45%$/);
  });
});

describe('finalizeWeather', () => {
  const plan: WeatherPlan = { base: 'clear', haze: 0.1, events: [] };

  it('rolls a downpour with probability .35 / .45 / .5 by intensity', () => {
    const n = 6000;
    for (const intensity of ['light', 'rush', 'gridlock'] as TrafficIntensity[]) {
      let rain = 0;
      for (let i = 0; i < n; i++) {
        if (finalizeWeather(plan, intensity, new Rng(i * 2654435761)).events.some((e) => e.kind === 'downpour')) rain += 1;
      }
      expect(Math.abs(rain / n - DOWNPOUR_CHANCE[intensity])).toBeLessThan(0.03);
    }
  });

  it('places events inside the trip and keeps smog spikes away from the rain', () => {
    for (let i = 0; i < 3000; i++) {
      const out = finalizeWeather({ base: 'haze', haze: 0.6, events: [] }, 'gridlock', new Rng(i + 1));
      const rain = out.events.find((e) => e.kind === 'downpour');
      const smog = out.events.find((e) => e.kind === 'haze_spike');
      if (rain) {
        expect(rain.atProgress).toBeGreaterThanOrEqual(0.3);
        expect(rain.atProgress).toBeLessThanOrEqual(0.7);
        expect(Number.isInteger(rain.duration)).toBe(true);
        expect(rain.duration).toBeGreaterThanOrEqual(60);
        expect(rain.duration).toBeLessThanOrEqual(120);
        expect(rain.intensity).toBeGreaterThanOrEqual(0.7);
      }
      if (smog) {
        expect(smog.atProgress).toBeGreaterThanOrEqual(0.15);
        expect(smog.atProgress).toBeLessThanOrEqual(0.85);
        if (rain) expect(Math.abs(smog.atProgress - rain.atProgress)).toBeGreaterThanOrEqual(EVENT_SPACING - 1e-9);
      }
      for (let k = 1; k < out.events.length; k++) {
        expect(out.events[k].atProgress).toBeGreaterThanOrEqual(out.events[k - 1].atProgress);
      }
    }
  });

  it('hazy days spike far more often than clear ones', () => {
    let hazy = 0;
    let clear = 0;
    for (let i = 0; i < 4000; i++) {
      if (finalizeWeather({ base: 'haze', haze: 0.6, events: [] }, 'light', new Rng(i + 9)).events.some((e) => e.kind === 'haze_spike')) hazy += 1;
      if (finalizeWeather(plan, 'light', new Rng(i + 9)).events.some((e) => e.kind === 'haze_spike')) clear += 1;
    }
    expect(Math.abs(hazy / 4000 - 0.7)).toBeLessThan(0.03);
    expect(Math.abs(clear / 4000 - 0.2)).toBeLessThan(0.03);
  });

  it('is deterministic, idempotent and leaves its input untouched', () => {
    const input: WeatherPlan = { base: 'overcast', haze: 0.2, events: [{ kind: 'downpour', atProgress: 0.1, duration: 5, intensity: 1 }] };
    const a = finalizeWeather(input, 'rush', new Rng(42));
    const b = finalizeWeather(a, 'rush', new Rng(42));
    expect(b).toEqual(a);
    expect(a.base).toBe('overcast');
    expect(a.haze).toBe(0.2);
    expect(input.events).toHaveLength(1);
    expect(input.events[0].atProgress).toBe(0.1);
  });
});

describe('rerollForecast', () => {
  it('spends the free reroll and then refuses', () => {
    const f = rollForecast(9, 3, 1);
    const r = rerollForecast(f);
    expect(r?.rerollsLeft).toBe(0);
    if (!r) throw new Error('first reroll must succeed');
    expect(rerollForecast(r)).toBeNull();
    expect(rerollForecast(rollForecast(9, 3, 0))).toBeNull();
    const twice = rerollForecast(rollForecast(1, 5, 2));
    expect(twice?.rerollsLeft).toBe(1);
    expect(twice && rerollForecast(twice)?.rerollsLeft).toBe(0);
  });

  it('always changes what the card shows, keeps the trip and is deterministic', () => {
    for (let seed = 0; seed < 400; seed++) {
      const f = rollForecast(seed, 4, 1, 'gridlock');
      const r = rerollForecast(f, 'gridlock');
      if (!r) throw new Error('reroll available');
      expect(r.tripNumber).toBe(4);
      expect(r.seed).not.toBe(f.seed);
      expect(r.timeOfDay !== f.timeOfDay || r.weather.base !== f.weather.base || r.district !== f.district).toBe(true);
      expect(r.summary).toBe(forecastSummary(r.timeOfDay, r.weather, 'gridlock'));
      expect(rerollForecast(f, 'gridlock')).toEqual(r);
    }
  });

  it('keeps the first trip in Sukhumvit while changing time or sky', () => {
    for (let seed = 0; seed < 200; seed++) {
      const f = rollForecast(seed, 1);
      const r = rerollForecast(f);
      expect(r?.district).toBe('sukhumvit');
      expect(r && (r.timeOfDay !== f.timeOfDay || r.weather.base !== f.weather.base)).toBe(true);
    }
  });
});
