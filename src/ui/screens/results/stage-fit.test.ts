import { describe, expect, it } from 'vitest';
import { fitFactor } from './stage-fit';

describe('fitFactor (Results stage on short screens)', () => {
  const phone = { w: 844 - 24, h: 390 - 16 };

  it('stays at 1 when the stage already fits', () => {
    expect(fitFactor({ w: 650, h: 334 }, 1, phone, 0.7)).toBe(1);
  });

  it('shrinks just enough for the limiting axis', () => {
    expect(fitFactor({ w: 650, h: 400 }, 1, phone, 0.7)).toBeCloseTo(374 / 400);
    expect(fitFactor({ w: 900, h: 300 }, 1, phone, 0.7)).toBeCloseTo(820 / 900);
  });

  it('measures relative to the factor already applied (no drift across resizes)', () => {
    const natural = { w: 700, h: 440 };
    const f1 = fitFactor(natural, 1, phone, 0.7);
    const shrunk = { w: natural.w * f1, h: natural.h * f1 };
    expect(fitFactor(shrunk, f1, phone, 0.7)).toBeCloseTo(f1);
    expect(fitFactor(shrunk, f1, { w: 1280, h: 720 }, 0.7)).toBe(1);
  });

  it('never goes below the floor and ignores an unmeasured (0×0) stage', () => {
    expect(fitFactor({ w: 700, h: 2000 }, 1, phone, 0.7)).toBe(0.7);
    expect(fitFactor({ w: 0, h: 0 }, 0.9, phone, 0.7)).toBe(0.9);
  });
});
