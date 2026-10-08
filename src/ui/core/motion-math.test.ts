import { describe, expect, it } from 'vitest';
import { springSamples } from './animate';
import { computeZoom } from './viewport-scale';
import { fmtBaht, fmtInt, fmtSigned } from './count-up';
import { comfortTone } from '../components/bars';

describe('springSamples (pop / slideIn / stamp keyframes)', () => {
  it('starts near 0, overshoots past 1 and settles exactly on 1', () => {
    const s = springSamples();
    expect(s[0]).toBeLessThan(0.2);
    expect(Math.max(...s)).toBeGreaterThan(1.02);
    expect(s[s.length - 1]).toBe(1);
  });
  it('a stiffer, more damped spring settles in fewer samples', () => {
    expect(springSamples({ k: 620, c: 40 }).length).toBeLessThan(springSamples({ k: 260, c: 12 }).length);
  });
  it('stays bounded (no runaway) for every preset used by the UI', () => {
    for (const p of [{}, { k: 260, c: 22 }, { k: 520, c: 14 }, { k: 620, c: 24 }, { k: 340, c: 17 }, { k: 420, c: 16 }]) {
      const s = springSamples(p);
      expect(Math.max(...s)).toBeLessThan(1.6);
      expect(s.length).toBeLessThan(241);
    }
  });
});

describe('computeZoom (design canvas 1280×720)', () => {
  it('is 1 at the design size and scales with the limiting axis', () => {
    expect(computeZoom(1280, 720)).toEqual({ hud: 1, ui: 1 });
    expect(computeZoom(1920, 1080).hud).toBeCloseTo(1.5);
    expect(computeZoom(2560, 720).hud).toBe(1);
  });
  it('clamps tiny and huge viewports so the HUD stays legible and never balloons', () => {
    expect(computeZoom(640, 360)).toEqual({ hud: 0.68, ui: 0.8 });
    expect(computeZoom(5120, 2880)).toEqual({ hud: 1.7, ui: 1.5 });
  });
});

describe('number formats', () => {
  it('groups thousands and signs with a real minus', () => {
    expect(fmtInt(7430.4)).toBe('7,430');
    expect(fmtSigned(1200)).toBe('+1,200');
    expect(fmtSigned(-30)).toBe('−30');
    expect(fmtSigned(0)).toBe('0');
    expect(fmtBaht(142)).toBe('฿142');
  });
});

describe('comfortTone', () => {
  it('maps 0..100 to bar tones at 60 / 30', () => {
    expect(comfortTone(60)).toBe('good');
    expect(comfortTone(59)).toBe('warn');
    expect(comfortTone(30)).toBe('warn');
    expect(comfortTone(29)).toBe('bad');
  });
});
