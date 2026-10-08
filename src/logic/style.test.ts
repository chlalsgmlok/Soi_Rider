import { describe, expect, it } from 'vitest';
import { StyleTracker } from './style';

describe('StyleTracker qualification', () => {
  it('near miss needs < 20 cm and > 10 km/h', () => {
    const s = new StyleTracker();
    expect(s.nearMiss(20, 30)).toBeNull();
    expect(s.nearMiss(5, 10)).toBeNull();
    expect(s.nearMiss(Number.NaN, 30)).toBeNull();
    expect(s.nearMiss(19.9, 10.1)).toEqual({ points: 40, combo: 0, ended: false, endedCombo: 0 });
    expect(s.nearMisses).toBe(1);
  });

  it('perfect gap needs both sides < 18 cm while riding', () => {
    const s = new StyleTracker();
    expect(s.perfectGap(18, 5, 12)).toBeNull();
    expect(s.perfectGap(5, 18, 12)).toBeNull();
    expect(s.perfectGap(5, 5, 2)).toBeNull();
    expect(s.perfectGap(17.9, 6, 12)?.points).toBe(150);
    expect(s.perfectGaps).toBe(1);
  });
});

describe('combos', () => {
  it('chains within 2.5 s (inclusive) and grows the multiplier by 0.25', () => {
    const s = new StyleTracker();
    expect(s.nearMiss(10, 30)?.points).toBe(40);
    s.update(2.0);
    expect(s.nearMiss(10, 30)).toEqual({ points: 50, combo: 1, ended: false, endedCombo: 0 });
    s.update(2.5);
    expect(s.nearMiss(10, 30)).toEqual({ points: 60, combo: 2, ended: false, endedCombo: 0 });
    expect(s.update(2.5)).toEqual({ points: 0, combo: 2, ended: false, endedCombo: 0 });
    expect(s.update(0.01)).toEqual({ points: 0, combo: 0, ended: true, endedCombo: 2 });
    expect(s.nearMiss(10, 30)).toEqual({ points: 40, combo: 0, ended: false, endedCombo: 0 });
    expect(s.maxCombo).toBe(2);
    expect(s.total).toBe(190);
  });

  it('caps the multiplier at ×3', () => {
    const s = new StyleTracker();
    const pts: number[] = [];
    for (let i = 0; i < 11; i++) {
      pts.push(s.nearMiss(10, 30)?.points ?? -1);
      s.update(1);
    }
    expect(pts).toEqual([40, 50, 60, 70, 80, 90, 100, 110, 120, 120, 120]);
    expect(s.multiplier).toBe(3);
    expect(s.maxCombo).toBe(10);
  });

  it('perfect gaps share the chain; 150 × 1.25 rounds to 188', () => {
    const s = new StyleTracker();
    s.nearMiss(10, 30);
    s.update(1);
    expect(s.perfectGap(10, 10, 12)).toEqual({ points: 188, combo: 1, ended: false, endedCombo: 0 });
  });

  it('a single near miss timing out is not reported as a combo', () => {
    const s = new StyleTracker();
    s.nearMiss(10, 30);
    expect(s.update(3).ended).toBe(false);
  });

  it('filter passes are a flat +15 that neither extend nor break the chain', () => {
    const s = new StyleTracker();
    s.nearMiss(10, 30);
    s.update(1);
    s.nearMiss(10, 30);
    s.update(2);
    expect(s.filterPass()).toEqual({ points: 15, combo: 1, ended: false, endedCombo: 0 });
    expect(s.update(0.6)).toEqual({ points: 0, combo: 0, ended: true, endedCombo: 1 });
    expect(s.filterPasses).toBe(1);
  });

  it('breakCombo ends the chain at once (fall, crash)', () => {
    const s = new StyleTracker();
    s.nearMiss(10, 30);
    s.nearMiss(10, 30);
    expect(s.breakCombo()).toEqual({ points: 0, combo: 0, ended: true, endedCombo: 1 });
    expect(s.nearMiss(10, 30)?.combo).toBe(0);
  });
});

describe('style cap', () => {
  it('stops at exactly 3000 points, clipping the last award', () => {
    const s = new StyleTracker();
    const awards: number[] = [];
    for (let i = 0; i < 30; i++) {
      awards.push(s.perfectGap(5, 5, 12)?.points ?? -1);
      s.update(1);
    }
    expect(s.total).toBe(3000);
    expect(awards.reduce((a, b) => a + b, 0)).toBe(3000);
    expect(awards[awards.length - 1]).toBe(0);
    const clipped = awards.find((p, i) => p > 0 && awards[i + 1] === 0);
    expect(clipped).toBeLessThanOrEqual(450);
    expect(s.filterPass().points).toBe(0);
  });
});
