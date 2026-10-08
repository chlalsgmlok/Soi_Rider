import { describe, expect, it } from 'vitest';
import { STARTER_LOADOUT } from '../core/config/catalog';
import { rollForecast } from './forecast';
import { createRunConfig, etaSeconds, nextTripNumber } from './run-setup';
import { createDefaultSave } from './save-defaults';

describe('nextTripNumber', () => {
  it('is one past the finished trips', () => {
    expect(nextTripNumber(createDefaultSave())).toBe(1);
    expect(nextTripNumber({ ...createDefaultSave(), tripsCompleted: 7 })).toBe(8);
  });
});

describe('etaSeconds', () => {
  it('divides the route by the reference speed (22 / 14 / 9 km/h), whole seconds', () => {
    expect(etaSeconds(1000, 'light')).toBe(164);
    expect(etaSeconds(1000, 'rush')).toBe(257);
    expect(etaSeconds(1000, 'gridlock')).toBe(400);
    expect(etaSeconds(600, 'rush')).toBe(154);
  });

  it('never returns less than 1 s, even for empty or broken input', () => {
    expect(etaSeconds(0, 'light')).toBe(1);
    expect(etaSeconds(-50, 'rush')).toBe(1);
    expect(etaSeconds(Number.NaN, 'gridlock')).toBe(1);
  });
});

describe('createRunConfig', () => {
  it('copies the forecast and loadout without sharing references', () => {
    const f = rollForecast(31337, 6);
    const c = createRunConfig(f, 'rush', STARTER_LOADOUT);
    expect(c).toMatchObject({ seed: 31337, tripNumber: 6, intensity: 'rush', timeOfDay: f.timeOfDay, district: f.district });
    expect(c.weather.base).toBe(f.weather.base);
    expect(c.weather.haze).toBe(f.weather.haze);
    expect(c.loadout).toEqual(STARTER_LOADOUT);
    expect(c.loadout).not.toBe(STARTER_LOADOUT);
    expect(f.weather.events).toEqual([]);
    expect(createRunConfig(f, 'rush', STARTER_LOADOUT)).toEqual(c);
  });

  it('rolls downpours at .35 / .45 / .5 and a heavier intensity keeps the lighter one\'s storm', () => {
    const n = 3000;
    const rain = { light: 0, rush: 0, gridlock: 0 };
    for (let seed = 1; seed <= n; seed++) {
      const f = rollForecast(seed * 977, 2);
      const storm = (i: 'light' | 'rush' | 'gridlock') =>
        createRunConfig(f, i, STARTER_LOADOUT).weather.events.find((e) => e.kind === 'downpour');
      const [l, r, g] = [storm('light'), storm('rush'), storm('gridlock')];
      if (l) rain.light += 1;
      if (r) rain.rush += 1;
      if (g) rain.gridlock += 1;
      if (l) expect(g).toEqual(l);
      if (r) expect(g).toEqual(r);
    }
    expect(Math.abs(rain.light / n - 0.35)).toBeLessThan(0.03);
    expect(Math.abs(rain.rush / n - 0.45)).toBeLessThan(0.03);
    expect(Math.abs(rain.gridlock / n - 0.5)).toBeLessThan(0.03);
  });
});
