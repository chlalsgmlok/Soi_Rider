import type { OBB, Vec2 } from './types/geometry';

/** Conventions: see src/core/types/geometry.ts. Pure functions, no allocation unless returning a Vec2. */

export const TAU = Math.PI * 2;
export const KMH = 3.6;
export const G = 9.81;

export const v2 = (x = 0, z = 0): Vec2 => ({ x, z });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
/** raw 2D cross (a.x·b.z − a.z·b.x); for left/right tests use sideOf() instead */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.z - a.z * b.x;
export const len = (a: Vec2): number => Math.hypot(a.x, a.z);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
export const dist2 = (a: Vec2, b: Vec2): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpV = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function normalize(a: Vec2): Vec2 {
  const l = Math.hypot(a.x, a.z);
  return l > 1e-9 ? { x: a.x / l, z: a.z / l } : { x: 0, z: 1 };
}

/** unit forward for heading θ */
export const forwardOf = (h: number): Vec2 => ({ x: Math.sin(h), z: Math.cos(h) });
/** unit right for heading θ */
export const rightOf = (h: number): Vec2 => ({ x: -Math.cos(h), z: Math.sin(h) });
/** unit left for heading θ */
export const leftOf = (h: number): Vec2 => ({ x: Math.cos(h), z: -Math.sin(h) });
/** heading θ of a direction vector */
export const headingOf = (d: Vec2): number => Math.atan2(d.x, d.z);

/** wrap to (-π, π] */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** shortest signed difference b − a */
export const angleDiff = (a: number, b: number): number => wrapAngle(b - a);

/**
 * Signed side of point p relative to a ray (origin o, heading h): > 0 = RIGHT of the ray, < 0 = LEFT.
 * Returns the lateral distance.
 */
export function sideOf(o: Vec2, h: number, p: Vec2): number {
  const r = rightOf(h);
  return (p.x - o.x) * r.x + (p.z - o.z) * r.z;
}

/** bicycle-model yaw rate. steerRad > 0 = right turn (heading decreases). */
export const yawRateFor = (speed: number, steerRad: number, wheelbase: number): number =>
  (-speed * Math.tan(steerRad)) / wheelbase;

/** world point from local (right, forward) offsets around a pose */
export function localToWorld(pos: Vec2, h: number, right: number, forward: number): Vec2 {
  const f = forwardOf(h);
  const r = rightOf(h);
  return { x: pos.x + r.x * right + f.x * forward, z: pos.z + r.z * right + f.z * forward };
}

/** OBB helper: centre + heading + full width/length */
export function makeOBB(cx: number, cz: number, width: number, length: number, angle: number): OBB {
  return { cx, cz, hw: width / 2, hl: length / 2, angle };
}

/** exponential smoothing factor for frame-rate independent damping: x += (target − x) * damp(rate, dt) */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/** closest point on segment ab to p, with t in 0..1 */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const l2 = abx * abx + abz * abz;
  const t = l2 > 1e-12 ? clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / l2, 0, 1) : 0;
  return { point: { x: a.x + abx * t, z: a.z + abz * t }, t };
}

/** total length of a polyline */
export function polylineLength(pts: readonly Vec2[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}
