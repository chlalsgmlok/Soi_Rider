import type { Vec2 } from '../../../core/types';
import type { MeshBuilder, P3 } from './mesh-builder';

/**
 * Oriented ground frame matching src/world/gen/road-geometry edgePoint(): origin o, unit direction d,
 * s along d, l along left(d) = (d.z, −d.x), y up.
 */
export interface GroundFrame {
  o: Vec2;
  d: Vec2;
}

export function at(F: GroundFrame, s: number, l: number, y: number): P3 {
  return [F.o.x + F.d.x * s + F.d.z * l, y, F.o.z + F.d.z * s - F.d.x * l];
}

/** world normal of the frame's +s / +l axes */
export const alongN = (F: GroundFrame, sign = 1): P3 => [F.d.x * sign, 0, F.d.z * sign];
export const leftN = (F: GroundFrame, sign = 1): P3 => [F.d.z * sign, 0, -F.d.x * sign];
export const UP: P3 = [0, 1, 0];

/** horizontal rectangle s0..s1 × l0..l1 at height y facing up */
export function flat(mb: MeshBuilder, F: GroundFrame, s0: number, s1: number, l0: number, l1: number, y: number): void {
  mb.quad(at(F, s0, l0, y), at(F, s1, l0, y), at(F, s1, l1, y), at(F, s0, l1, y), UP);
}

/** vertical wall along s at lateral l, from y0 to y1, facing ±l */
export function wallS(mb: MeshBuilder, F: GroundFrame, s0: number, s1: number, l: number, y0: number, y1: number, face: 1 | -1): void {
  mb.quad(at(F, s0, l, y0), at(F, s1, l, y0), at(F, s1, l, y1), at(F, s0, l, y1), leftN(F, face));
}

/** vertical wall across l at station s, from y0 to y1, facing ±s */
export function wallL(mb: MeshBuilder, F: GroundFrame, s: number, l0: number, l1: number, y0: number, y1: number, face: 1 | -1): void {
  mb.quad(at(F, s, l0, y0), at(F, s, l1, y0), at(F, s, l1, y1), at(F, s, l0, y1), alongN(F, face));
}

export interface SlabFaces {
  top?: boolean;
  lo?: boolean;
  hi?: boolean;
  start?: boolean;
  end?: boolean;
}

/** box s0..s1 × l0..l1 × y0..y1 with selectable faces (lo/hi = l0/l1 sides, start/end = s0/s1 ends) */
export function slab(mb: MeshBuilder, F: GroundFrame, s0: number, s1: number, l0: number, l1: number, y0: number, y1: number, f: SlabFaces = {}): void {
  if (f.top ?? true) flat(mb, F, s0, s1, l0, l1, y1);
  if (f.lo ?? true) wallS(mb, F, s0, s1, l0, y0, y1, -1);
  if (f.hi ?? true) wallS(mb, F, s0, s1, l1, y0, y1, 1);
  if (f.start ?? true) wallL(mb, F, s0, l0, l1, y0, y1, -1);
  if (f.end ?? true) wallL(mb, F, s1, l0, l1, y0, y1, 1);
}

/** split [a, b] into pieces no longer than `max` (at least one piece) */
export function pieces(a: number, b: number, max: number): Array<[number, number]> {
  const n = Math.max(1, Math.ceil((b - a) / max - 1e-6));
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) out.push([a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n]);
  return out;
}

/** annulus sector in the XZ plane around (cx, cz) at height y, angles in radians (0 = +x, CCW toward −z is not assumed) */
export function ring(mb: MeshBuilder, cx: number, cz: number, r0: number, r1: number, a0: number, a1: number, y: number, segs: number): void {
  for (let i = 0; i < segs; i++) {
    const t0 = a0 + ((a1 - a0) * i) / segs;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
    const p = (r: number, t: number): P3 => [cx + Math.cos(t) * r, y, cz + Math.sin(t) * r];
    mb.quad(p(r0, t0), p(r1, t0), p(r1, t1), p(r0, t1), UP);
  }
}

/** disc (fan of quads with a degenerate centre) */
export function disc(mb: MeshBuilder, cx: number, cz: number, r: number, y: number, segs: number): void {
  ring(mb, cx, cz, 0, r, 0, Math.PI * 2, y, segs);
}

/** vertical cylindrical wall segment (radius r, angles a0..a1) facing outward (+1) or inward (−1) */
export function arcWall(mb: MeshBuilder, cx: number, cz: number, r: number, a0: number, a1: number, y0: number, y1: number, segs: number, face: 1 | -1): void {
  for (let i = 0; i < segs; i++) {
    const t0 = a0 + ((a1 - a0) * i) / segs;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
    const tm = (t0 + t1) / 2;
    const n: P3 = [Math.cos(tm) * face, 0, Math.sin(tm) * face];
    const p = (t: number, y: number): P3 => [cx + Math.cos(t) * r, y, cz + Math.sin(t) * r];
    mb.quad(p(t0, y0), p(t1, y0), p(t1, y1), p(t0, y1), n);
  }
}
