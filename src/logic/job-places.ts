import type { Rng } from '../core/rng';
import type { POI, PoiKind, PassengerTrait, Vec2 } from '../core/types';
import {
  DISTANCE_BAND_ORDER, estimateMeters, MIN_OFFER_GAP, MIN_TRIP_METERS, outsideRange, PICKUP_RANGE, type DistanceBand,
  type Range,
} from './job-distances';

/** Where the gram offers start and end (used by jobs.ts): trait-weighted pickups and well-spread drops. */

/** how much a trait prefers a POI kind as pickup / drop (default 1) */
const PICKUP_AFFINITY: Record<PassengerTrait, Partial<Record<PoiKind, number>>> = {
  hurry: { condo: 2, office: 2, bts: 2 },
  nervous: { condo: 2, school: 1.5 },
  tourist: { hotel: 3, bts: 1.5, pier: 1.5 },
  shopper: { market: 4, mall: 4, food: 1.5 },
  regular: { food: 2, market: 2, condo: 1.5 },
};
const DROP_AFFINITY: Record<PassengerTrait, Partial<Record<PoiKind, number>>> = {
  hurry: { office: 3, bts: 3, hospital: 2, school: 2 },
  nervous: { hospital: 2, temple: 2, condo: 2, school: 1.5 },
  tourist: { temple: 2, mall: 2, market: 2, pier: 2, shrine: 2 },
  shopper: { condo: 2.5, hotel: 2 },
  regular: { condo: 2, market: 2, food: 2, temple: 1.5 },
};

export const round10 = (m: number): number => Math.round(m / 10) * 10;

/**
 * Picks a POI whose estimated distance from `from` lies in `range`, weighted by trait affinity (and ×4 for landmarks
 * when the passenger is a tourist going sightseeing), preferring ids not in `avoid`. Falls back to the candidate
 * closest to the range.
 */
function choosePoi(
  rng: Rng, pois: readonly POI[], from: Vec2, range: Range,
  affinity: Partial<Record<PoiKind, number>>, landmarkBoost: number, avoid: ReadonlySet<number> = new Set(),
): POI {
  const inRange = pois.filter((p) => outsideRange(estimateMeters(from, p.pos), range) === 0);
  const fresh = inRange.filter((p) => !avoid.has(p.id));
  const pool = fresh.length > 0 ? fresh : inRange;
  if (pool.length > 0) return rng.weighted(pool, (p) => (affinity[p.kind] ?? 1) * (p.landmark ? landmarkBoost : 1));
  let best = pois[0];
  let bestErr = Infinity;
  for (const p of pois) {
    const err = outsideRange(estimateMeters(from, p.pos), range);
    if (err < bestErr) {
      best = p;
      bestErr = err;
    }
  }
  return best;
}

/** three distinct pickups 120–450 m (estimated) from the stand, chosen by trait affinity */
export function choosePickups(rng: Rng, pois: readonly POI[], spawn: Vec2, traits: readonly PassengerTrait[]): POI[] {
  const used = new Set<number>();
  return traits.map((trait) => {
    const free = pois.filter((p) => !used.has(p.id));
    const pickup = choosePoi(rng, free.length >= 2 ? free : pois, spawn, PICKUP_RANGE, PICKUP_AFFINITY[trait], 1);
    used.add(pickup.id);
    return pickup;
  });
}

export type DropInput = {
  pois: readonly POI[];
  pickups: readonly POI[];
  traits: readonly PassengerTrait[];
  bands: readonly DistanceBand[];
  ranges: Readonly<Record<DistanceBand, Range>>;
};

export const tripMeters = (pickup: POI, drop: POI): number => round10(estimateMeters(pickup.pos, drop.pos));

/** smallest difference between two offers' trip lengths */
function smallestGap(pickups: readonly POI[], drops: readonly POI[]): number {
  const m = drops.map((d, i) => tripMeters(pickups[i], d)).sort((a, b) => a - b);
  let gap = Infinity;
  for (let i = 1; i < m.length; i++) gap = Math.min(gap, m[i] - m[i - 1]);
  return gap;
}

/**
 * One pass over the bands, short → long (`ascending`) or long → short: each pick only considers drops at least
 * MIN_OFFER_GAP longer (shorter) than the previous pick, when the pickup has any.
 */
function pickDrops(rng: Rng, I: DropInput, ascending: boolean): POI[] {
  const tripRange: Range = [I.ranges.short[0], I.ranges.long[1]];
  const rank = (i: number): number => DISTANCE_BAND_ORDER.indexOf(I.bands[i]);
  const order = I.bands.map((_, i) => i).sort((a, b) => (ascending ? rank(a) - rank(b) : rank(b) - rank(a)));
  const usedDrops = new Set<number>();
  const drops: POI[] = [];
  let bound = ascending ? 0 : Infinity;
  for (const i of order) {
    const pickup = I.pickups[i];
    const all = I.pois.filter((p) => p.id !== pickup.id);
    const inTrip = all.filter((p) => outsideRange(estimateMeters(pickup.pos, p.pos), tripRange) === 0);
    const base = inTrip.length > 0 ? inTrip : all;
    const fits = (p: POI): boolean => (ascending ? tripMeters(pickup, p) >= bound : tripMeters(pickup, p) <= bound);
    let spaced = base.filter(fits);
    /* squeezing from the long end may push the short offer below its band, never below MIN_TRIP_METERS */
    if (spaced.length === 0 && !ascending) spaced = all.filter((p) => fits(p) && tripMeters(pickup, p) >= MIN_TRIP_METERS);
    const drop = choosePoi(rng, spaced.length > 0 ? spaced : base, pickup.pos, I.ranges[I.bands[i]],
      DROP_AFFINITY[I.traits[i]], I.traits[i] === 'tourist' ? 4 : 1, usedDrops);
    usedDrops.add(drop.id);
    drops[i] = drop;
    bound = tripMeters(pickup, drop) + (ascending ? MIN_OFFER_GAP : -MIN_OFFER_GAP);
  }
  return drops;
}

/**
 * Drops for the three offers so they read as clearly different trips: a short → long pass, and when a sparse map leaves
 * two offers closer than MIN_OFFER_GAP, a long → short pass too; the better spread wins.
 */
export function chooseDrops(rng: Rng, I: DropInput): POI[] {
  const up = pickDrops(rng, I, true);
  const upGap = smallestGap(I.pickups, up);
  if (upGap >= MIN_OFFER_GAP) return up;
  const down = pickDrops(rng, I, false);
  return smallestGap(I.pickups, down) > upGap ? down : up;
}
