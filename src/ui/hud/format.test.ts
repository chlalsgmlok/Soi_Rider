import { describe, expect, it } from 'vitest';
import { etaState, fmtClock, fmtDistance, gapBand, splitPopup, stableSpeed } from './format';
import { mapSourceFromCity } from './map-source';
import type { CityData } from '../../core/types/world';

describe('fmtDistance', () => {
  it('shows metres exactly under 100, rounded to 10 m below 1 km, then km (one decimal under 10 km)', () => {
    expect(fmtDistance(7.4)).toEqual({ num: '7', unit: 'm' });
    expect(fmtDistance(99.4)).toEqual({ num: '99', unit: 'm' });
    expect(fmtDistance(342)).toEqual({ num: '340', unit: 'm' });
    expect(fmtDistance(994)).toEqual({ num: '990', unit: 'm' });
    expect(fmtDistance(995)).toEqual({ num: '1.0', unit: 'km' });
    expect(fmtDistance(9960)).toEqual({ num: '10', unit: 'km' });
    expect(fmtDistance(1260)).toEqual({ num: '1.3', unit: 'km' });
    expect(fmtDistance(12600)).toEqual({ num: '13', unit: 'km' });
  });
  it('never shows a negative distance', () => {
    expect(fmtDistance(-20)).toEqual({ num: '0', unit: 'm' });
  });
});

describe('fmtClock', () => {
  it('pads minutes and seconds and floors fractions', () => {
    expect(fmtClock(192.9)).toBe('03:12');
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(3599)).toBe('59:59');
  });
  it('formats late (negative) time by absolute value', () => {
    expect(fmtClock(-41)).toBe('00:41');
  });
});

describe('thresholds', () => {
  it('etaState: ≥ 30 s ok, 0–30 s warn, < 0 late', () => {
    expect(etaState(30)).toBe('ok');
    expect(etaState(29.9)).toBe('warn');
    expect(etaState(0)).toBe('warn');
    expect(etaState(-0.1)).toBe('late');
  });
  it('gapBand: ≥ 30 cm ok (cyan), 10–30 tight (amber), < 10 critical (coral)', () => {
    expect(gapBand(30)).toBe('ok');
    expect(gapBand(29.9)).toBe('tight');
    expect(gapBand(10)).toBe('tight');
    expect(gapBand(9.9)).toBe('critical');
    expect(gapBand(0)).toBe('critical');
  });
});

describe('splitPopup', () => {
  it('separates the label from trailing points', () => {
    expect(splitPopup('NEAR MISS ×3 +120')).toEqual({ label: 'NEAR MISS ×3', pts: '+120' });
    expect(splitPopup('FILTER +15')).toEqual({ label: 'FILTER', pts: '+15' });
    expect(splitPopup('MIRROR −1,200')).toEqual({ label: 'MIRROR', pts: '−1,200' });
  });
  it('keeps label-only popups intact', () => {
    expect(splitPopup('PERFECT GAP')).toEqual({ label: 'PERFECT GAP', pts: '' });
    expect(splitPopup('+50')).toEqual({ label: '+50', pts: '' });
  });
});

describe('stableSpeed', () => {
  it('holds the shown value inside ±0.6 km/h so 14.5 does not flicker', () => {
    expect(stableSpeed(14.5, 14)).toBe(14);
    expect(stableSpeed(14.55, 15)).toBe(15);
    expect(stableSpeed(15.4, 14)).toBe(15);
  });
  it('uses the magnitude when reversing', () => {
    expect(stableSpeed(-6.2, 0)).toBe(6);
  });
});

describe('mapSourceFromCity', () => {
  const city = {
    nodes: [
      { id: 1, pos: { x: 0, z: 0 } },
      { id: 2, pos: { x: 0, z: 100 } },
      { id: 3, pos: { x: 900, z: 0 } },
      { id: 4, pos: { x: 900, z: 100 } },
    ],
    edges: [
      { a: 1, b: 2, lanesAB: 1, lanesBA: 1, laneWidth: 3.2, median: 0, cls: 'soi' },
      { a: 3, b: 4, lanesAB: 2, lanesBA: 2, laneWidth: 3.5, median: 1, cls: 'main' },
    ],
  } as unknown as CityData;

  it('returns only roads near the query point, with paved width = lanes × laneWidth + median', () => {
    const near = mapSourceFromCity(city)({ x: 10, z: 50 }, 50);
    expect(near).toHaveLength(1);
    expect(near[0].width).toBeCloseTo(6.4);
    expect(near[0].cls).toBe('soi');
    const far = mapSourceFromCity(city)({ x: 880, z: 50 }, 30);
    expect(far.map((r) => r.width)).toEqual([15]);
  });
});
