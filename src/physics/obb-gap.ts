import type { Circle, OBB, Vec2 } from '../core/types';
import { closestOnObb, obbCorner } from './obb-math';
import { obbOverlap } from './sat';

/** Closest points of two shapes: `onA` lies on A's surface, `onB` on B's. */
export interface GapPoints {
  onA: Vec2;
  onB: Vec2;
}

export const newGapPoints = (): GapPoints => ({ onA: { x: 0, z: 0 }, onB: { x: 0, z: 0 } });

const corner: Vec2 = { x: 0, z: 0 };
const near: Vec2 = { x: 0, z: 0 };

/**
 * Separation distance between two oriented boxes (0 when they touch or overlap). For disjoint convex polygons
 * the minimum is reached at a vertex of one of them, so 8 vertex→box queries are exact.
 * `out` receives the closest point pair (for overlaps: both set to the contact midpoint).
 */
export function obbGap(a: OBB, b: OBB, out?: GapPoints): number {
  if (obbOverlap(a, b)) {
    if (out) {
      closestOnObb(b, a.cx, a.cz, out.onB);
      out.onA.x = out.onB.x;
      out.onA.z = out.onB.z;
    }
    return 0;
  }
  let best = Infinity;
  for (let pass = 0; pass < 2; pass++) {
    const from = pass === 0 ? a : b;
    const to = pass === 0 ? b : a;
    for (let i = 0; i < 4; i++) {
      obbCorner(from, i, corner);
      const d = closestOnObb(to, corner.x, corner.z, near);
      if (d < best) {
        best = d;
        if (out) {
          const pf = pass === 0 ? out.onA : out.onB;
          const pt = pass === 0 ? out.onB : out.onA;
          pf.x = corner.x;
          pf.z = corner.z;
          pt.x = near.x;
          pt.z = near.z;
        }
      }
    }
  }
  return best;
}

/** separation between a box and a circle (0 when overlapping) */
export function obbCircleGap(a: OBB, c: Circle, out?: GapPoints): number {
  const p = out ? out.onA : near;
  const d = closestOnObb(a, c.cx, c.cz, p);
  const gap = Math.max(0, d - c.r);
  if (out) {
    if (d > 1e-9) {
      out.onB.x = c.cx + ((p.x - c.cx) / d) * c.r;
      out.onB.z = c.cz + ((p.z - c.cz) / d) * c.r;
    } else {
      out.onB.x = c.cx;
      out.onB.z = c.cz;
    }
  }
  return gap;
}
