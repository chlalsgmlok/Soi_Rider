import { dist } from '../core/math2d';
import type { POI, Vec2 } from '../core/types';

/**
 * Trip-distance rules of the gram offers (docs/GAME_DESIGN.md §2 Intro, §11): road-distance estimate and the
 * short / medium / long bands, adapted to how far the generated city actually reaches.
 */

/** straight-line → road distance estimate */
export const ROUTE_FACTOR = 1.35;
export type Range = readonly [number, number];
/** estimated metres from the win stand to the pickup */
export const PICKUP_RANGE: Range = [120, 450];
export type DistanceBand = 'short' | 'medium' | 'long';
export const DISTANCE_BAND_ORDER: readonly DistanceBand[] = ['short', 'medium', 'long'];
/** design bands for a city large enough to serve 1.6 km trips */
export const DISTANCE_BANDS: Readonly<Record<DistanceBand, Range>> = {
  short: [350, 700],
  medium: [700, 1100],
  long: [1100, 1600],
};
export const TRIP_RANGE: Range = [DISTANCE_BANDS.short[0], DISTANCE_BANDS.long[1]];
/** the next-longer offer is at least this much longer, so short / medium / long read as different trips (when the map allows) */
export const MIN_OFFER_GAP = 40;
/** the shortest trip ever offered, even when a sparse map's offers are squeezed apart */
export const MIN_TRIP_METERS = 250;
/** on a map too small for 350 m trips the short band starts at this fraction of the reach instead */
export const MIN_TRIP_FRACTION = 2 / 3;

export const estimateMeters = (a: Vec2, b: Vec2): number => dist(a, b) * ROUTE_FACTOR;

/** 0 inside [lo, hi], otherwise the distance to the range */
export const outsideRange = (v: number, [lo, hi]: Range): number => (v < lo ? lo - v : v > hi ? v - hi : 0);

/** the farthest estimated trip from `from` to any other destination (0 when there is none) */
export function reachFrom(from: POI, destinations: readonly POI[]): number {
  let far = 0;
  for (const d of destinations) if (d.id !== from.id) far = Math.max(far, estimateMeters(from.pos, d.pos));
  return far;
}

/**
 * The design bands when the city reaches 1600 m; otherwise the same bands compressed linearly into
 * [min(350, ⅔ · reach), reach], so the three offers still read as short / medium / long on a compact map
 * (the 520 m district square tops out around 990 m estimated).
 */
export function bandsForReach(reach: number): Readonly<Record<DistanceBand, Range>> {
  const [min, max] = TRIP_RANGE;
  if (!(reach < max)) return DISTANCE_BANDS;
  const hi = Math.max(0, reach);
  const lo = Math.min(min, hi * MIN_TRIP_FRACTION);
  const map = (m: number): number => lo + ((m - min) * (hi - lo)) / (max - min);
  const band = ([a, b]: Range): Range => [map(a), map(b)];
  return { short: band(DISTANCE_BANDS.short), medium: band(DISTANCE_BANDS.medium), long: band(DISTANCE_BANDS.long) };
}
