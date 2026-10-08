import type { Vec2 } from '../../core/types';

/** Small segment/ray helpers used by the layout stage (canonical frame, metres). */

export interface SegLike {
  a: Vec2;
  b: Vec2;
}

export const crossV = (ax: number, az: number, bx: number, bz: number): number => ax * bz - az * bx;

/** distance along a ray from p0 (inside the square of half size `half`) to its boundary */
export function rayToBounds(p0: Vec2, d: Vec2, half: number): number {
  let t = Infinity;
  if (d.x > 1e-9) t = Math.min(t, (half - p0.x) / d.x);
  if (d.x < -1e-9) t = Math.min(t, (-half - p0.x) / d.x);
  if (d.z > 1e-9) t = Math.min(t, (half - p0.z) / d.z);
  if (d.z < -1e-9) t = Math.min(t, (-half - p0.z) / d.z);
  return t;
}

/** perpendicular coordinate of segment a→b at along-coordinate q (clamped to the segment) */
export function perpAt(a: Vec2, b: Vec2, q: number, al: (p: Vec2) => number, pp: (p: Vec2) => number): number {
  const span = al(b) - al(a);
  const t = Math.abs(span) < 1e-9 ? 0 : Math.min(1, Math.max(0, (q - al(a)) / span));
  return pp(a) + (pp(b) - pp(a)) * t;
}

/** t along the ray p0 + d·t where it meets segment s (within s's extent ± tol metres), or null */
export function intersectRay(p0: Vec2, d: Vec2, s: SegLike, tol = 1.5): number | null {
  const ex = s.b.x - s.a.x;
  const ez = s.b.z - s.a.z;
  const den = crossV(d.x, d.z, ex, ez);
  if (Math.abs(den) < 1e-9) return null;
  const wx = s.a.x - p0.x;
  const wz = s.a.z - p0.z;
  const t = crossV(wx, wz, ex, ez) / den;
  const u = crossV(wx, wz, d.x, d.z) / den;
  const len = Math.hypot(ex, ez);
  return u * len >= -tol && u * len <= len + tol ? t : null;
}

export function distToSeg(p: Vec2, s: SegLike): number {
  const ex = s.b.x - s.a.x;
  const ez = s.b.z - s.a.z;
  const l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - s.a.x) * ex + (p.z - s.a.z) * ez) / l2)) : 0;
  return Math.hypot(p.x - (s.a.x + ex * t), p.z - (s.a.z + ez * t));
}
