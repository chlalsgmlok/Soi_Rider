import type { Circle, OBB, Vec2 } from '../core/types';
import { closestOnObb, obbRadiusOn, toObbLocal } from './obb-math';

/** Penetration of A into B: moving A by `normal · depth` separates them (normal is unit, B → A). */
export interface Penetration {
  normal: Vec2;
  depth: number;
}

export const newPenetration = (): Penetration => ({ normal: { x: 0, z: 0 }, depth: 0 });

const shared = newPenetration();

/**
 * Separating-axis test of two oriented boxes. Tests the four face normals; returns the axis of least overlap
 * (oriented from B toward A) or null when separated. Touching (zero overlap) counts as separated.
 * Pass `out` to avoid sharing the module scratch result.
 */
export function obbOverlap(a: OBB, b: OBB, out: Penetration = shared): Penetration | null {
  const dx = a.cx - b.cx;
  const dz = a.cz - b.cz;
  let best = Infinity;
  let bx = 0;
  let bz = 0;
  for (let i = 0; i < 4; i++) {
    const o = i < 2 ? a : b;
    const s = Math.sin(o.angle);
    const c = Math.cos(o.angle);
    // even = right axis, odd = forward axis of box o
    const ax = i % 2 === 0 ? -c : s;
    const az = i % 2 === 0 ? s : c;
    const dist = dx * ax + dz * az;
    const overlap = obbRadiusOn(a, ax, az) + obbRadiusOn(b, ax, az) - Math.abs(dist);
    if (overlap <= 0) return null;
    if (overlap < best) {
      best = overlap;
      const sign = dist < 0 ? -1 : 1;
      bx = ax * sign;
      bz = az * sign;
    }
  }
  out.normal.x = bx;
  out.normal.z = bz;
  out.depth = best;
  return out;
}

const cp: Vec2 = { x: 0, z: 0 };

/**
 * Box vs circle. The normal pushes the BOX out of the circle. When the circle centre is inside the box the
 * shortest exit through the nearest face is used.
 */
export function obbCircleOverlap(a: OBB, c: Circle, out: Penetration = shared): Penetration | null {
  const d = closestOnObb(a, c.cx, c.cz, cp);
  if (d > 1e-6) {
    if (d >= c.r) return null;
    out.normal.x = (cp.x - c.cx) / d;
    out.normal.z = (cp.z - c.cz) / d;
    out.depth = c.r - d;
    return out;
  }
  // centre inside the box: exit along the face with the least travel
  const l = toObbLocal(a, c.cx, c.cz);
  const exitR = a.hw - Math.abs(l.r);
  const exitF = a.hl - Math.abs(l.f);
  const s = Math.sin(a.angle);
  const k = Math.cos(a.angle);
  if (exitR < exitF) {
    // circle sits on the +r side → push the box toward −r (and vice versa)
    const sign = l.r > 0 ? -1 : 1;
    out.normal.x = -k * sign;
    out.normal.z = s * sign;
    out.depth = exitR + c.r;
  } else {
    const sign = l.f > 0 ? -1 : 1;
    out.normal.x = s * sign;
    out.normal.z = k * sign;
    out.depth = exitF + c.r;
  }
  return out;
}

/** representative contact point between two overlapping boxes (midway between their closest surfaces) */
export function contactPointObb(a: OBB, b: OBB, out: Vec2): Vec2 {
  closestOnObb(b, a.cx, a.cz, cp);
  const bx = cp.x;
  const bz = cp.z;
  closestOnObb(a, bx, bz, out);
  out.x = (out.x + bx) / 2;
  out.z = (out.z + bz) / 2;
  return out;
}

export function contactPointCircle(a: OBB, c: Circle, out: Vec2): Vec2 {
  closestOnObb(a, c.cx, c.cz, out);
  return out;
}
