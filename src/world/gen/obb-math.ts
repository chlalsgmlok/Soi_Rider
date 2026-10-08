import type { Lane, OBB } from '../../core/types';
import { headingOf } from '../../core/math2d';

/** Boolean overlap tests for generator placement (sim heading convention: forward = (sin θ, cos θ)). */

/** separating-axis test (allocation free); `pad` grows the gap required to count as separate */
export function obbIntersects(a: OBB, b: OBB, pad = 0): boolean {
  const fax = Math.sin(a.angle);
  const faz = Math.cos(a.angle);
  const fbx = Math.sin(b.angle);
  const fbz = Math.cos(b.angle);
  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  // axes: fa, ra = (−faz, fax), fb, rb = (−fbz, fbx)
  const c = Math.abs(fax * fbx + faz * fbz);
  const s = Math.abs(fax * fbz - faz * fbx);
  if (Math.abs(dx * fax + dz * faz) > a.hl + b.hl * c + b.hw * s + pad) return false;
  if (Math.abs(-dx * faz + dz * fax) > a.hw + b.hl * s + b.hw * c + pad) return false;
  if (Math.abs(dx * fbx + dz * fbz) > b.hl + a.hl * c + a.hw * s + pad) return false;
  if (Math.abs(-dx * fbz + dz * fbx) > b.hw + a.hl * s + a.hw * c + pad) return false;
  return true;
}

/** distance from a point to an OBB (0 inside) */
export function pointObbDist(x: number, z: number, o: OBB): number {
  const fx = Math.sin(o.angle);
  const fz = Math.cos(o.angle);
  const dx = x - o.cx;
  const dz = z - o.cz;
  const u = Math.max(0, Math.abs(-dx * fz + dz * fx) - o.hw);
  const v = Math.max(0, Math.abs(dx * fx + dz * fz) - o.hl);
  return Math.sqrt(u * u + v * v);
}

/** axis-aligned bounds of an OBB: [minX, minZ, maxX, maxZ] (written into `out` when given) */
export function obbAabb(o: OBB, out: [number, number, number, number] = [0, 0, 0, 0]): [number, number, number, number] {
  const ex = Math.abs(Math.cos(o.angle)) * o.hw + Math.abs(Math.sin(o.angle)) * o.hl;
  const ez = Math.abs(Math.sin(o.angle)) * o.hw + Math.abs(Math.cos(o.angle)) * o.hl;
  out[0] = o.cx - ex;
  out[1] = o.cz - ez;
  out[2] = o.cx + ex;
  out[3] = o.cz + ez;
  return out;
}

/** the paved rectangle a lane occupies (centre line ± width/2, start..end) */
export function laneObb(l: Lane): OBB {
  return {
    cx: (l.start.x + l.end.x) / 2, cz: (l.start.z + l.end.z) / 2,
    hw: l.width / 2, hl: l.length / 2, angle: headingOf(l.dir),
  };
}
