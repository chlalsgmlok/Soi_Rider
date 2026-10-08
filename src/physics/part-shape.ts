import type { Circle, OBB } from '../core/types';
import { rangesOverlap, tumbleAt } from './body-heights';
import { insetWidth } from './obb-math';
import type { ObstaclePart } from './obstacle-scan';

/** The 2D footprint of an obstacle part at one height band (vehicles are narrower above the belt line). */
export interface BandShape {
  obb: OBB | null;
  circle: Circle | null;
}

/**
 * Footprint of `part` within the vertical band [y0, y1], written into `out` (its `obb` slot uses `scratch`).
 * Returns false when the part does not reach into the band at all (e.g. a bus mirror above the rider's helmet,
 * a water barrier below a scooter mirror).
 */
export function shapeAtBand(part: ObstaclePart, y0: number, y1: number, scratch: OBB, out: BandShape): boolean {
  if (!rangesOverlap(part.y0, part.y1, y0, y1)) return false;
  out.circle = part.circle;
  out.obb = null;
  if (part.obb) {
    const t = part.role === 'body' && part.profile ? tumbleAt(part.profile, y0) : 0;
    out.obb = t > 0 ? insetWidth(part.obb, t, scratch) : part.obb;
  }
  return out.obb !== null || out.circle !== null;
}
