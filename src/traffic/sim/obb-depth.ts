import type { OBB } from '../../core/types';

/** projection radius of an OBB on unit axis (ax, az) */
function radiusOn(o: OBB, ax: number, az: number): number {
  const fx = Math.sin(o.angle);
  const fz = Math.cos(o.angle);
  // right(θ) = (−cos θ, sin θ) = (−fz, fx)
  return o.hw * Math.abs(-fz * ax + fx * az) + o.hl * Math.abs(fx * ax + fz * az);
}

/**
 * Separating-axis penetration depth of two oriented boxes (0 when they do not overlap): the smallest overlap of
 * their projections over the four box axes. Allocation-free.
 */
export function obbPenetration(a: OBB, b: OBB): number {
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  let depth = Infinity;
  for (let k = 0; k < 4; k++) {
    const o = k < 2 ? a : b;
    const fx = Math.sin(o.angle);
    const fz = Math.cos(o.angle);
    const ax = k % 2 === 0 ? fx : -fz;
    const az = k % 2 === 0 ? fz : fx;
    const overlap = radiusOn(a, ax, az) + radiusOn(b, ax, az) - Math.abs(dx * ax + dz * az);
    if (overlap <= 0) return 0;
    if (overlap < depth) depth = overlap;
  }
  return depth;
}

/** cheap bounding-circle pre-test */
export function obbMayTouch(a: OBB, b: OBB, pad = 0): boolean {
  const r = Math.hypot(a.hw, a.hl) + Math.hypot(b.hw, b.hl) + pad;
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  return dx * dx + dz * dz <= r * r;
}

/** write an OBB in place */
export function setObb(o: OBB, cx: number, cz: number, hw: number, hl: number, angle: number): void {
  o.cx = cx;
  o.cz = cz;
  o.hw = hw;
  o.hl = hl;
  o.angle = angle;
}
