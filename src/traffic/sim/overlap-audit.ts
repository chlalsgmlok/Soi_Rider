import { obbMayTouch, obbPenetration } from './obb-depth';
import type { Vehicle } from './vehicle';

/** body penetration (m) above which two NPCs count as overlapping */
export const OVERLAP_TOLERANCE = 0.2;
/** half the longest body (bus) + slack: pairs further apart along x can not touch */
const REACH = 12.5;

export interface OverlapReport {
  /** pairs deeper than the tolerance */
  count: number;
  /** deepest penetration found (m) */
  max: number;
  /** ids of the deepest pair (debugging) */
  a: number;
  b: number;
}

const order: Vehicle[] = [];
const byX = (p: Vehicle, q: Vehicle): number => p.obb.cx - q.obb.cx;

/**
 * NPC–NPC body overlap audit (hulls only, mirrors excluded): sort-and-sweep along x, bounding-circle pre-test,
 * then SAT depth. Run by tests and the sandbox stats.
 */
export function auditOverlaps(vehicles: readonly Vehicle[], out: OverlapReport): OverlapReport {
  out.count = 0;
  out.max = 0;
  out.a = out.b = -1;
  order.length = 0;
  for (const v of vehicles) if (v.alive) order.push(v);
  order.sort(byX);
  for (let i = 0; i < order.length; i++) {
    const a = order[i];
    for (let j = i + 1; j < order.length; j++) {
      const b = order[j];
      if (b.obb.cx - a.obb.cx > REACH) break;
      if (!obbMayTouch(a.obb, b.obb)) continue;
      const d = obbPenetration(a.obb, b.obb);
      if (d > out.max) {
        out.max = d;
        out.a = a.id;
        out.b = b.id;
      }
      if (d > OVERLAP_TOLERANCE) out.count++;
    }
  }
  return out;
}
