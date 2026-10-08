import type { OBB } from '../../../core/types';

/** local (right, forward) coordinates of a point in an OBB's frame (sim heading convention) */
export function obbLocal(o: OBB, x: number, z: number): [number, number] {
  const dx = x - o.cx;
  const dz = z - o.cz;
  const s = Math.sin(o.angle);
  const c = Math.cos(o.angle);
  return [-dx * c + dz * s, dx * s + dz * c];
}

/** point inside the OBB grown by `margin` */
export function insideObb(o: OBB, x: number, z: number, margin = 0): boolean {
  const [r, f] = obbLocal(o, x, z);
  return Math.abs(r) <= o.hw + margin && Math.abs(f) <= o.hl + margin;
}
