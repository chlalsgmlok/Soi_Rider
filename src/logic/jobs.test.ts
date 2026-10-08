import { describe, expect, it } from 'vitest';
import { dist } from '../core/math2d';
import { Rng } from '../core/rng';
import type { JobOffer } from '../core/types';
import { fareFor } from './earnings';
import { bandsForReach, DISTANCE_BANDS, estimateMeters, reachFrom } from './job-distances';
import { generateOffers } from './jobs';
import { isFemalePassenger, LOCALS, TOURISTS } from './passengers';
import { makeCity, makeCompactCity } from './testing/fixtures';

const city = makeCity();
const poi = (id: number) => {
  const p = city.pois.find((q) => q.id === id);
  if (!p) throw new Error(`no poi ${id}`);
  return p;
};

describe('generateOffers', () => {
  it('returns 3 offers with distinct traits, pickups, passengers and short/medium/long distances', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const offers = generateOffers(city, new Rng(seed), 'rush', 4);
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map((o) => o.passenger.trait)).size).toBe(3);
      expect(new Set(offers.map((o) => o.pickupPoi)).size).toBe(3);
      expect(new Set(offers.map((o) => o.passenger.name)).size).toBe(3);
      expect(new Set(offers.map((o) => o.id)).size).toBe(3);
      const [s, m, l] = offers.map((o) => o.estMeters);
      expect(s).toBeGreaterThanOrEqual(DISTANCE_BANDS.short[0]);
      expect(s).toBeLessThanOrEqual(DISTANCE_BANDS.short[1]);
      expect(m).toBeGreaterThanOrEqual(DISTANCE_BANDS.medium[0]);
      expect(m).toBeLessThanOrEqual(DISTANCE_BANDS.medium[1]);
      expect(l).toBeGreaterThanOrEqual(DISTANCE_BANDS.long[0]);
      expect(l).toBeLessThanOrEqual(DISTANCE_BANDS.long[1]);
    }
  });

  it('estimates distances as straight line × 1.35 (10 m), pickups 120–450 m from the stand, fare from the formula', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const o of generateOffers(city, new Rng(seed), 'gridlock', 2)) {
        const p = poi(o.pickupPoi);
        const d = poi(o.dropPoi);
        expect(o.pickupPoi).not.toBe(o.dropPoi);
        expect(o.pickupPoi).not.toBe(city.spawn.poi);
        expect(o.estMeters).toBe(Math.round((dist(p.pos, d.pos) * 1.35) / 10) * 10);
        expect(o.approachMeters).toBe(Math.round((dist(city.spawn.pos, p.pos) * 1.35) / 10) * 10);
        expect(o.approachMeters).toBeGreaterThanOrEqual(120);
        expect(o.approachMeters).toBeLessThanOrEqual(450);
        expect(o.fareBaht).toBe(fareFor(o.estMeters, 'gridlock'));
        expect(o.fareBaht).toBe(Math.round(40 + o.estMeters * 0.08 * 1.5));
      }
    }
  });

  it('builds plausible passengers: roster names, tourists for the tourist trait, ratings 4.3–5.0, palette looks', () => {
    const touristNames = TOURISTS.map((t) => t.name);
    const localNames = LOCALS.map((t) => t.name);
    for (let seed = 1; seed <= 80; seed++) {
      for (const o of generateOffers(city, new Rng(seed), 'light', 5)) {
        const p = o.passenger;
        expect(p.trait === 'tourist' ? touristNames : localNames).toContain(p.name);
        expect(p.rating).toBeGreaterThanOrEqual(4.3);
        expect(p.rating).toBeLessThanOrEqual(5);
        expect(Math.round(p.rating * 10)).toBeCloseTo(p.rating * 10, 6);
        expect(p.look.skin).toMatch(/^#[0-9A-F]{6}$/i);
        expect(['hair_short', 'hair_long', 'hair_bun', 'hat_cap']).toContain(p.look.hair);
        expect(p.origin.length).toBeGreaterThan(0);
        if (p.trait === 'regular') expect(p.origin).toBe(isFemalePassenger(p) ? '단골 이모' : '단골 삼촌');
        expect(o.note).toMatch(/[가-힣]/);
      }
    }
  });

  it('the first trip always includes a regular', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(generateOffers(city, new Rng(seed), 'rush', 1).map((o) => o.passenger.trait)).toContain('regular');
    }
  });

  it('is deterministic per rng seed and varies between seeds', () => {
    const a = generateOffers(city, new Rng(2024), 'rush', 3);
    expect(generateOffers(city, new Rng(2024), 'rush', 3)).toEqual(a);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) seen.add(JSON.stringify(generateOffers(city, new Rng(seed), 'rush', 3)));
    expect(seen.size).toBe(30);
  });

  it('intensity only changes the fare, not the trip layout', () => {
    const strip = (os: JobOffer[]) => os.map(({ fareBaht: _f, ...rest }) => rest);
    const light = generateOffers(city, new Rng(8), 'light', 3);
    const grid = generateOffers(city, new Rng(8), 'gridlock', 3);
    expect(strip(grid)).toEqual(strip(light));
    for (let i = 0; i < 3; i++) expect(grid[i].fareBaht).toBeGreaterThan(light[i].fareBaht);
  });

  it('degrades gracefully on tiny cities and refuses impossible ones', () => {
    const tiny = makeCity([60]);
    const offers = generateOffers(tiny, new Rng(3), 'rush', 2);
    expect(offers).toHaveLength(3);
    for (const o of offers) expect(o.pickupPoi).not.toBe(o.dropPoi);
    const empty = { ...tiny, pois: tiny.pois.slice(0, 1) };
    expect(() => generateOffers(empty, new Rng(3), 'rush', 2)).toThrow(/at least 2 POIs/);
  });
});

describe('distance bands', () => {
  it('keeps the design bands when the city reaches 1.6 km', () => {
    expect(bandsForReach(1600)).toBe(DISTANCE_BANDS);
    expect(bandsForReach(2400)).toBe(DISTANCE_BANDS);
    expect(DISTANCE_BANDS).toEqual({ short: [350, 700], medium: [700, 1100], long: [1100, 1600] });
  });

  it('compresses linearly into [350, reach] on a compact map (520 m square ≈ 990 m reach)', () => {
    const b = bandsForReach(990);
    expect(b.short[0]).toBe(350);
    expect(b.short[1]).toBeCloseTo(529.2, 9);
    expect(b.medium[0]).toBeCloseTo(529.2, 9);
    expect(b.medium[1]).toBeCloseTo(734, 9);
    expect(b.long[0]).toBeCloseTo(734, 9);
    expect(b.long[1]).toBeCloseTo(990, 9);
  });

  it('starts below 350 m only when the reach is under 525 m (⅔ rule)', () => {
    expect(bandsForReach(525).short[0]).toBeCloseTo(350, 9);
    const b = bandsForReach(450);
    expect(b.short[0]).toBeCloseTo(300, 9);
    expect(b.short[1]).toBeCloseTo(342, 9);
    expect(b.medium[1]).toBeCloseTo(390, 9);
    expect(b.long[1]).toBeCloseTo(450, 9);
    expect(bandsForReach(0)).toEqual({ short: [0, 0], medium: [0, 0], long: [0, 0] });
  });

  it('reach is the farthest straight-line × 1.35 estimate to another POI', () => {
    const compact = makeCompactCity();
    const corner = compact.pois.find((p) => p.pos.x === -240 && p.pos.z === -240);
    if (!corner) throw new Error('fixture lost its corner POI');
    expect(reachFrom(corner, compact.pois)).toBeCloseTo(Math.hypot(480, 480) * 1.35, 9);
    expect(reachFrom(corner, [corner])).toBe(0);
    expect(estimateMeters({ x: 0, z: 0 }, { x: 300, z: 400 })).toBeCloseTo(675, 9);
  });
});

describe('generateOffers on a compact district', () => {
  const compact = makeCompactCity();
  const service = compact.pois.filter((p) => p.kind !== 'win_stand');
  const byId = new Map(compact.pois.map((p) => [p.id, p]));
  const at = (id: number) => {
    const p = byId.get(id);
    if (!p) throw new Error(`no poi ${id}`);
    return p;
  };

  it('still offers clearly short < medium < long trips inside the compressed bands', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const offers = generateOffers(compact, new Rng(seed), 'rush', 3);
      const [s, m, l] = offers.map((o) => o.estMeters);
      expect(m - s).toBeGreaterThanOrEqual(20);
      expect(l - m).toBeGreaterThanOrEqual(20);
      expect(s).toBeGreaterThanOrEqual(350);
      expect(l).toBeLessThanOrEqual(920);
      const bands = bandsForReach(Math.max(...offers.map((o) => reachFrom(at(o.pickupPoi), service))));
      const inBand = (v: number, [lo, hi]: readonly [number, number]) => v >= lo - 5 && v <= hi + 5;
      expect(inBand(s, bands.short)).toBe(true);
      expect(inBand(m, bands.medium)).toBe(true);
      expect(inBand(l, bands.long)).toBe(true);
    }
  });

  it('never sends a passenger to or from a win stand and spreads pickups / drops', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const offers = generateOffers(compact, new Rng(seed), 'gridlock', 9);
      expect(new Set(offers.map((o) => o.dropPoi)).size).toBe(3);
      expect(new Set(offers.map((o) => o.pickupPoi)).size).toBe(3);
      for (const o of offers) {
        expect(at(o.pickupPoi).kind).not.toBe('win_stand');
        expect(at(o.dropPoi).kind).not.toBe('win_stand');
        expect(o.approachMeters).toBeGreaterThanOrEqual(120);
        expect(o.approachMeters).toBeLessThanOrEqual(450);
      }
    }
  });
});
