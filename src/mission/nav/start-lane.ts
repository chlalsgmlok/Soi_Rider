import type { CityData, Vec2 } from '../../core/types';
import type { LanePoint } from './lane-search';

/** a lane running against the rider only wins when no lane runs their way within this many extra metres */
export const WRONG_WAY_COST = 25;
/** lanes farther than this are never a route start */
export const START_SEARCH = 60;

/**
 * Where a route begins for a rider at `pos` facing `heading`: the nearest lane that runs the rider's way. Works from
 * the sidewalk, inside a junction box and while riding counterflow (the lane under the bike then runs the other way,
 * so the start snaps to the nearest lane of the rider's direction instead). Null when no lane is in reach.
 */
export function startPoint(data: CityData, pos: Vec2, heading: number, maxDist = START_SEARCH): LanePoint | null {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let best = -1;
  let bestS = 0;
  let bestScore = Infinity;
  for (const l of data.lanes) {
    const rx = pos.x - l.start.x;
    const rz = pos.z - l.start.z;
    const s = Math.min(l.length, Math.max(0, rx * l.dir.x + rz * l.dir.z));
    const d = Math.hypot(rx - l.dir.x * s, rz - l.dir.z * s);
    if (d > maxDist) continue;
    const align = l.dir.x * fx + l.dir.z * fz;
    const score = d + (align < 0.2 ? WRONG_WAY_COST : 0) + (1 - align) * 1.5;
    if (score < bestScore) {
      bestScore = score;
      best = l.id;
      bestS = s;
    }
  }
  return best >= 0 ? { lane: best, s: bestS } : null;
}

/** arc position of a point projected onto a lane (clamped to the lane) */
export function laneOffsetOf(data: CityData, lane: number, p: Vec2): number {
  const l = data.lanes[lane];
  return Math.min(l.length, Math.max(0, (p.x - l.start.x) * l.dir.x + (p.z - l.start.z) * l.dir.z));
}
