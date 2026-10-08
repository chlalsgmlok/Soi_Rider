import { describe, expect, it } from 'vitest';
import type { TimeOfDay } from '../../core/types';
import { copyLook, createLook, lerpLook, lookFromPreset, type LookState } from './env-look';
import { TOD_PRESETS } from './tod-presets';
import { applyWeather } from './weather-look';

const luma = (l: LookState, k: 'hemiSky' | 'skyZenith' | 'fogColor'): number =>
  l[k].r * 0.2126 + l[k].g * 0.7152 + l[k].b * 0.0722;
const TODS: TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const look = (tod: TimeOfDay, w = { overcast: 0, rain: 0, haze: 0 }): LookState =>
  applyWeather(lookFromPreset(TOD_PRESETS[tod]), w, createLook());

describe('weather look', () => {
  it('clear weather is the identity', () => {
    for (const tod of TODS) {
      const base = lookFromPreset(TOD_PRESETS[tod]);
      const out = applyWeather(base, { overcast: 0, rain: 0, haze: 0 }, createLook());
      expect(out.sunIntensity).toBe(base.sunIntensity);
      expect(out.hemiSky.equals(base.hemiSky)).toBe(true);
      expect(out.fogDensity).toBe(base.fogDensity);
    }
  });

  it('never mutates the base look', () => {
    const base = lookFromPreset(TOD_PRESETS.sunset);
    const before = copyLook(base, createLook());
    applyWeather(base, { overcast: 1, rain: 1, haze: 1 }, createLook());
    expect(base.sunIntensity).toBe(before.sunIntensity);
    expect(base.hemiSky.equals(before.hemiSky)).toBe(true);
  });

  it('rain swallows the sun and its shadows, switches the lamps on and darkens dusk', () => {
    for (const tod of TODS) {
      const dry = look(tod);
      const wet = look(tod, { overcast: 0, rain: 1, haze: 0 });
      expect(wet.sunIntensity).toBeLessThan(dry.sunIntensity * 0.15);
      expect(wet.shadowIntensity).toBeLessThan(dry.shadowIntensity * 0.25);
      expect(wet.lamps).toBeGreaterThanOrEqual(Math.min(1, dry.lamps + 0.6));
      expect(wet.fogDensity).toBeGreaterThan(dry.fogDensity);
      expect(wet.warmth).toBeLessThan(dry.warmth);
      expect(wet.night).toBeGreaterThanOrEqual(dry.night);
    }
    expect(look('sunset', { overcast: 0, rain: 1, haze: 0 }).exposure).toBeLessThan(look('sunset').exposure);
  });

  it('weather keeps night dark (fill light is retinted, not brightened)', () => {
    const dry = look('night');
    const wet = look('night', { overcast: 1, rain: 1, haze: 0 });
    expect(luma(wet, 'hemiSky')).toBeLessThanOrEqual(luma(dry, 'hemiSky') * 1.01);
    expect(wet.stars).toBe(0);
  });

  it('haze thickens a warm smog and washes out the grade', () => {
    const dry = look('noon');
    const smog = look('noon', { overcast: 0, rain: 0, haze: 1 });
    expect(smog.fogDensity).toBeGreaterThan(dry.fogDensity * 4);
    expect(smog.fogColor.r).toBeGreaterThan(smog.fogColor.b);
    expect(smog.saturation).toBeLessThan(dry.saturation);
    expect(smog.contrast).toBeLessThan(dry.contrast);
  });

  it('overcast gives soft light: weak sun, faint shadows, brighter fill by day', () => {
    const dry = look('noon');
    const grey = look('noon', { overcast: 1, rain: 0, haze: 0 });
    expect(grey.sunIntensity).toBeLessThan(dry.sunIntensity * 0.25);
    expect(grey.shadowIntensity).toBeLessThan(dry.shadowIntensity * 0.4);
    expect(grey.hemiIntensity).toBeGreaterThan(dry.hemiIntensity);
  });

  it('time-of-day blends take the short way round the azimuth', () => {
    const a = lookFromPreset(TOD_PRESETS.sunset);
    const b = lookFromPreset(TOD_PRESETS.sunset);
    a.sunAzimuth = 350;
    b.sunAzimuth = 10;
    expect(lerpLook(a, b, 0.5, createLook()).sunAzimuth % 360).toBeCloseTo(0, 6);
  });
});
