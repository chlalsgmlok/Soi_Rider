import type { OBB, Vec2 } from '../core/types';

/**
 * Allocation-free OBB primitives in the sim convention (src/core/types/geometry.ts):
 * forward(θ) = (sin θ, cos θ), right(θ) = (−cos θ, sin θ); `hw` runs along right, `hl` along forward.
 */

/** local coordinates of a point in an OBB frame: r = along right, f = along forward */
export interface ObbLocal {
  r: number;
  f: number;
}

const scratch: ObbLocal = { r: 0, f: 0 };

export function toObbLocal(o: OBB, px: number, pz: number, out: ObbLocal = scratch): ObbLocal {
  const s = Math.sin(o.angle);
  const c = Math.cos(o.angle);
  const dx = px - o.cx;
  const dz = pz - o.cz;
  out.r = -dx * c + dz * s;
  out.f = dx * s + dz * c;
  return out;
}

/** world point from OBB-local (right, forward) offsets */
export function fromObbLocal(o: OBB, r: number, f: number, out: Vec2): Vec2 {
  const s = Math.sin(o.angle);
  const c = Math.cos(o.angle);
  out.x = o.cx - c * r + s * f;
  out.z = o.cz + s * r + c * f;
  return out;
}

/** corner i ∈ 0..3: (+r,+f), (−r,+f), (−r,−f), (+r,−f) */
export function obbCorner(o: OBB, i: number, out: Vec2): Vec2 {
  const sr = i === 0 || i === 3 ? 1 : -1;
  const sf = i < 2 ? 1 : -1;
  return fromObbLocal(o, sr * o.hw, sf * o.hl, out);
}

/** half extent of the box projected onto a unit axis (ax, az) */
export function obbRadiusOn(o: OBB, ax: number, az: number): number {
  const s = Math.sin(o.angle);
  const c = Math.cos(o.angle);
  return o.hw * Math.abs(-c * ax + s * az) + o.hl * Math.abs(s * ax + c * az);
}

export function pointInObb(o: OBB, px: number, pz: number): boolean {
  const l = toObbLocal(o, px, pz);
  return Math.abs(l.r) <= o.hw && Math.abs(l.f) <= o.hl;
}

/**
 * Closest point of the SOLID box to p (p itself when inside). Returns the distance (0 inside).
 */
export function closestOnObb(o: OBB, px: number, pz: number, out: Vec2): number {
  const l = toObbLocal(o, px, pz);
  const r = l.r < -o.hw ? -o.hw : l.r > o.hw ? o.hw : l.r;
  const f = l.f < -o.hl ? -o.hl : l.f > o.hl ? o.hl : l.f;
  fromObbLocal(o, r, f, out);
  return Math.hypot(px - out.x, pz - out.z);
}

/** bounding radius around the centre */
export const obbBoundRadius = (o: OBB): number => Math.hypot(o.hw, o.hl);

/** copy b into a (keeps `a`'s identity — used for pooled hull boxes) */
export function copyObb(a: OBB, b: OBB): OBB {
  a.cx = b.cx;
  a.cz = b.cz;
  a.hw = b.hw;
  a.hl = b.hl;
  a.angle = b.angle;
  return a;
}

/** a box shrunk (or grown, d < 0) by d on both sides of its width */
export function insetWidth(o: OBB, d: number, out: OBB): OBB {
  copyObb(out, o);
  out.hw = Math.max(0.01, o.hw - d);
  return out;
}
