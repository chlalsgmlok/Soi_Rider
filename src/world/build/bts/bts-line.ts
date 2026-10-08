import type { Placement, Vec2 } from '../../../core/types';
import { forwardOf, leftOf } from '../../../core/math2d';

/** deck model: tracks at local x = ±TRACK_X, rail tops at RAIL_Y */
export const TRACK_X = 2.0;
export const RAIL_Y = 10.9;

/** The skytrain line as the BTS deck placements lay it out. */
export interface BtsLine {
  /** a point on the line and the unit direction of +s */
  o: Vec2;
  dir: Vec2;
  /** heading of +s travel (sim convention) */
  heading: number;
  /** deck extent along s */
  s0: number;
  s1: number;
  /** station centre along s, or null */
  station: number | null;
}

/** recover the line from bts_deck / bts_station placements (null when the district has no skytrain) */
export function btsLine(placements: readonly Placement[]): BtsLine | null {
  const decks = placements.filter((p) => p.asset === 'bts_deck');
  if (decks.length === 0) return null;
  const heading = decks[0].heading;
  const dir = forwardOf(heading);
  const o = decks[0].pos;
  const sOf = (p: Vec2): number => (p.x - o.x) * dir.x + (p.z - o.z) * dir.z;
  let s0 = Infinity;
  let s1 = -Infinity;
  for (const d of decks) {
    s0 = Math.min(s0, sOf(d.pos) - 20);
    s1 = Math.max(s1, sOf(d.pos) + 20);
  }
  const st = placements.find((p) => p.asset === 'bts_station');
  return { o, dir, heading, s0, s1, station: st ? sOf(st.pos) : null };
}

/** world XZ of the track centre at s for travel direction `sign` (trains keep LEFT like the roads) */
export function trackPoint(L: BtsLine, s: number, sign: 1 | -1): Vec2 {
  const left = leftOf(L.heading);
  return { x: L.o.x + L.dir.x * s + left.x * TRACK_X * sign, z: L.o.z + L.dir.z * s + left.z * TRACK_X * sign };
}
