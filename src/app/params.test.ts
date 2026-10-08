import { describe, expect, it } from 'vitest';
import { readParams } from './params';

describe('readParams', () => {
  it('reads every QA parameter', () => {
    const p = readParams('?seed=42&district=silom&intensity=gridlock&tod=night&weather=storm&skip=play&bot=1&q=low&job=2');
    expect(p).toEqual({
      seed: 42, district: 'silom', intensity: 'gridlock', tod: 'night', weather: 'storm', skip: 'play', bot: true,
      quality: 'low', job: 2,
    });
  });

  it('defaults to a normal game when the URL says nothing', () => {
    expect(readParams('')).toEqual({
      seed: null, district: null, intensity: null, tod: null, weather: null, skip: null, bot: false, quality: null, job: 0,
    });
  });

  it('ignores unknown values instead of guessing', () => {
    const p = readParams('?seed=abc&district=paris&intensity=heavy&tod=dusk&weather=snow&skip=credits&bot=yes&q=ultra&job=-3');
    expect(p.seed).toBeNull();
    expect(p.district).toBeNull();
    expect(p.intensity).toBeNull();
    expect(p.tod).toBeNull();
    expect(p.weather).toBeNull();
    expect(p.skip).toBeNull();
    expect(p.bot).toBe(false);
    expect(p.quality).toBeNull();
    expect(p.job).toBe(0);
  });

  it('keeps seeds whole and non-negative', () => {
    expect(readParams('?seed=-17.8').seed).toBe(17);
  });
});
