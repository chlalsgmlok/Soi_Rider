import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { MIN_OFFER_GAP, MIN_TRIP_METERS } from './job-distances';
import { generateOffers } from './jobs';
import { makeCompactCity, makeSparseCity } from './testing/fixtures';

/** smallest difference between the three offered trip lengths */
const gapOf = (meters: number[]): number => Math.min(meters[1] - meters[0], meters[2] - meters[1]);

describe('offer spread on small maps', () => {
  it('a real-sized district (17 scattered POIs) always offers three clearly different trip lengths', () => {
    /* before the spacing passes these maps gave 168 of 1200 offer sets under 40 m apart, 10 of them exact ties */
    const gaps: number[] = [];
    let shortest = Infinity;
    for (let c = 0; c < 30; c++) {
      const city = makeSparseCity(c);
      expect(city.pois.length).toBe(18);
      for (let s = 0; s < 40; s++) {
        const meters = generateOffers(city, new Rng(s * 31 + c), 'rush', 2).map((o) => o.estMeters);
        gaps.push(gapOf(meters));
        shortest = Math.min(shortest, meters[0]);
      }
    }
    expect(gaps).toHaveLength(1200);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MIN_OFFER_GAP);
    expect(shortest).toBeGreaterThanOrEqual(MIN_TRIP_METERS);
  });

  it('the compact grid district always spaces the offers by at least MIN_OFFER_GAP', () => {
    const city = makeCompactCity();
    for (let s = 0; s < 400; s++) {
      expect(gapOf(generateOffers(city, new Rng(s), 'light', 1 + (s % 6)).map((o) => o.estMeters))).toBeGreaterThanOrEqual(MIN_OFFER_GAP);
    }
  });

  it('very sparse maps (12 POIs) never offer a trip under MIN_TRIP_METERS', () => {
    for (let c = 30; c < 60; c++) {
      const city = makeSparseCity(c, 12);
      for (let s = 0; s < 20; s++) {
        for (const o of generateOffers(city, new Rng(s + c * 7), 'gridlock', 3)) expect(o.estMeters).toBeGreaterThanOrEqual(MIN_TRIP_METERS);
      }
    }
  });
});
