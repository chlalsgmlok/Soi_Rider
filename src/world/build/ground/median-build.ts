import type { OBB, StaticCollider } from '../../../core/types';
import { forwardOf } from '../../../core/math2d';
import type { ChunkSet } from '../kit/chunk-set';
import { CURB, HEIGHTS, PIECE } from '../kit/dims';
import { alongN, at, flat, type GroundFrame, leftN, pieces } from '../kit/frame-shapes';
import type { P3 } from '../kit/mesh-builder';
import { CURB_PROUD, curbSegment, stripeCount } from './curb-profile';
import { G, type GroundStyle } from './ground-style';

/** the median collider stays this far inside the painted kerb (src/world/gen/medians.ts KERB_INSET) */
const KERB_INSET = 0.06;

export interface MedianRun {
  F: GroundFrame;
  hl: number;
  hw: number;
}

/** raised median runs recovered from their colliders (centre frame, half length along, true half width) */
export function medianRuns(colliders: readonly StaticCollider[]): MedianRun[] {
  return colliders
    .filter((c): c is StaticCollider & { obb: OBB } => c.tag === 'median' && c.obb !== undefined)
    .map((c) => ({ F: { o: { x: c.obb.cx, z: c.obb.cz }, d: forwardOf(c.obb.angle) }, hl: c.obb.hl, hw: c.obb.hw + KERB_INSET }));
}

function curbRun(chunks: ChunkSet, a: P3, b: P3, out: readonly [number, number], colors: readonly [string, string]): void {
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = stripeCount(L);
  const top = HEIGHTS.median + CURB_PROUD;
  for (let k = 0; k < n; k++) {
    const t0 = k / n;
    const t1 = (k + 1) / n;
    const pa: P3 = [a[0] + (b[0] - a[0]) * t0, 0, a[2] + (b[2] - a[2]) * t0];
    const pb: P3 = [a[0] + (b[0] - a[0]) * t1, 0, a[2] + (b[2] - a[2]) * t1];
    curbSegment(chunks.at((pa[0] + pb[0]) / 2, (pa[2] + pb[2]) / 2), pa, pb, out, HEIGHTS.road, top, colors[k % 2]);
  }
}

/** raised medians: planted soil top inside a black-white painted kerb ring */
export function buildMedians(runs: readonly MedianRun[], chunks: ChunkSet, style: GroundStyle): void {
  const w = CURB.width;
  for (const { F, hl, hw } of runs) {
    for (const [a, b] of pieces(-hl + w, hl - w, PIECE)) {
      const mid = at(F, (a + b) / 2, 0, 0);
      chunks.at(mid[0], mid[2]).color(style.soil).kind(G.soil);
      flat(chunks.at(mid[0], mid[2]), F, a, b, -hw + w, hw - w, HEIGHTS.median);
    }
    for (const sgn of [1, -1] as const) {
      const n = leftN(F, -sgn);
      curbRun(chunks, at(F, -hl, sgn * hw, 0), at(F, hl, sgn * hw, 0), [n[0], n[2]], style.medianCurb);
      const e = alongN(F, -sgn);
      curbRun(chunks, at(F, sgn * hl, -hw, 0), at(F, sgn * hl, hw, 0), [e[0], e[2]], style.medianCurb);
    }
  }
}
