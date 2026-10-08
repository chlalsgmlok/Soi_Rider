import type { Bounds2, RoadEdge, RoadNode, Vec2 } from '../../../core/types';
import { bulbRadius, halfWidth } from '../../gen/road-profile';
import { dirFrom, nodeKind } from '../../gen/road-geometry';
import type { ChunkSet } from '../kit/chunk-set';
import { HEIGHTS } from '../kit/dims';
import { at, leftN } from '../kit/frame-shapes';
import type { P3 } from '../kit/mesh-builder';
import { CURB_PROUD, curbCap, curbSegment, stripeCount } from './curb-profile';
import type { EdgeSpan } from './edge-spans';
import type { GroundStyle } from './ground-style';

const BUS_ZONE = 9;

/** the iconic painted curbs: red-white along sidewalks, yellow-white at bus stops */
export function buildCurbs(spans: readonly EdgeSpan[], busStops: readonly Vec2[], chunks: ChunkSet, style: GroundStyle): number {
  const top = HEIGHTS.sidewalk + CURB_PROUD;
  const colorsAt = (p: P3): readonly [string, string] =>
    busStops.some((b) => (b.x - p[0]) ** 2 + (b.z - p[2]) ** 2 < BUS_ZONE * BUS_ZONE) ? style.busCurb : style.curb;
  let segments = 0;
  for (const S of spans) {
    if (!S.raised) continue;
    const { F, hw } = S;
    for (const sp of S.sides) {
      const L = sp.c1 - sp.c0;
      if (L < 0.2) continue;
      const sgn = sp.side;
      const n3 = leftN(F, sgn);
      const out: [number, number] = [n3[0], n3[2]];
      const n = stripeCount(L);
      for (let k = 0; k < n; k++) {
        const a = sp.c0 + (L * k) / n;
        const b = sp.c0 + (L * (k + 1)) / n;
        const pa = at(F, a, sgn * hw, HEIGHTS.road);
        const pb = at(F, b, sgn * hw, HEIGHTS.road);
        const mid: P3 = [(pa[0] + pb[0]) / 2, 0, (pa[2] + pb[2]) / 2];
        curbSegment(chunks.at(mid[0], mid[2]), pa, pb, out, HEIGHTS.road, top, colorsAt(mid)[k % 2]);
        segments++;
      }
      const startFree = S.exitA && sp.c0 < 0;
      const endFree = S.exitB && sp.c1 > S.e.length;
      if (startFree) {
        const p = at(F, sp.c0, sgn * hw, 0);
        curbCap(chunks.at(p[0], p[2]), p, [-F.d.x, -F.d.z], out, HEIGHTS.road, top, style.curb[0]);
      }
      if (endFree) {
        const p = at(F, sp.c1, sgn * hw, 0);
        curbCap(chunks.at(p[0], p[2]), p, [F.d.x, F.d.z], out, HEIGHTS.road, top, style.curb[(n - 1) % 2]);
      }
    }
  }
  return segments;
}

/** curb arcs around raised dead-end turnarounds */
export function buildBulbCurbs(nodes: readonly RoadNode[], edges: readonly RoadEdge[], bounds: Bounds2, chunks: ChunkSet, style: GroundStyle): void {
  const top = HEIGHTS.sidewalk + CURB_PROUD;
  for (const nd of nodes) {
    if (nodeKind(nodes, edges, bounds, nd.id) !== 'deadEnd') continue;
    const e = edges[nd.edges[0]];
    if (e.sidewalk <= 0) continue;
    const R = bulbRadius(e);
    const d = dirFrom(e, nd.id);
    const mouth = Math.atan2(d.z, d.x);
    const gap = Math.asin(Math.min(0.99, halfWidth(e) / R));
    const a0 = mouth + gap;
    const span = Math.PI * 2 - 2 * gap;
    const n = stripeCount(span * R);
    const mb = chunks.at(nd.pos.x, nd.pos.z);
    for (let k = 0; k < n; k++) {
      for (let h = 0; h < 2; h++) {
        const t0 = a0 + (span * (k + h / 2)) / n;
        const t1 = a0 + (span * (k + (h + 1) / 2)) / n;
        const tm = (t0 + t1) / 2;
        const pa: P3 = [nd.pos.x + Math.cos(t0) * R, 0, nd.pos.z + Math.sin(t0) * R];
        const pb: P3 = [nd.pos.x + Math.cos(t1) * R, 0, nd.pos.z + Math.sin(t1) * R];
        curbSegment(mb, pa, pb, [Math.cos(tm), Math.sin(tm)], HEIGHTS.road, top, style.curb[k % 2]);
      }
    }
  }
}
