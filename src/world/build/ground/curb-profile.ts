import type { MeshBuilder, P3 } from '../kit/mesh-builder';
import { CURB } from '../kit/dims';
import { G } from './ground-style';

/** how far a curb stone stands proud of the slab it borders */
export const CURB_PROUD = 0.015;

/**
 * One curb stone segment from base points a→b on the road edge: vertical road face, rounded nose (bevel), flat top
 * reaching CURB.width away from the road along `out` (unit, horizontal), and the small proud step at its back.
 */
export function curbSegment(mb: MeshBuilder, a: P3, b: P3, out: readonly [number, number], y0: number, top: number, color: string): void {
  const bv = CURB.bevel;
  const w = CURB.width;
  const o = (p: P3, k: number, y: number): P3 => [p[0] + out[0] * k, y, p[2] + out[1] * k];
  const toRoad: P3 = [-out[0], 0, -out[1]];
  const nose: P3 = [-out[0] * 0.7071, 0.7071, -out[1] * 0.7071];
  mb.color(color).kind(G.curb);
  mb.quad(o(a, 0, y0), o(b, 0, y0), o(b, 0, top - bv), o(a, 0, top - bv), toRoad);
  mb.quad(o(a, 0, top - bv), o(b, 0, top - bv), o(b, bv, top), o(a, bv, top), nose);
  mb.quad(o(a, bv, top), o(b, bv, top), o(b, w, top), o(a, w, top), [0, 1, 0]);
  mb.quad(o(a, w, top), o(b, w, top), o(b, w, top - CURB_PROUD - 0.01), o(a, w, top - CURB_PROUD - 0.01), [out[0], 0, out[1]]);
}

/** end cap of a curb run (closes the profile where a run stops) */
export function curbCap(mb: MeshBuilder, a: P3, along: readonly [number, number], out: readonly [number, number], y0: number, top: number, color: string): void {
  const w = CURB.width;
  const p = (k: number, y: number): P3 => [a[0] + out[0] * k, y, a[2] + out[1] * k];
  mb.color(color).kind(G.curb);
  mb.quad(p(0, y0), p(w, y0), p(w, top), p(0, top), [along[0], 0, along[1]]);
}

/**
 * Alternating stripe lengths for a run of length L: an odd number of ~CURB.stripe segments so both ends start with
 * the same (first) colour — corners where two runs overlap then always agree.
 */
export function stripeCount(L: number): number {
  let n = Math.max(1, Math.round(L / CURB.stripe));
  if (n % 2 === 0) n += 1;
  return n;
}
