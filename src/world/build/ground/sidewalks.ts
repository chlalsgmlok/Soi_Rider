import type { Bounds2, RoadEdge, RoadNode } from '../../../core/types';
import { bulbRadius, halfWidth, verge } from '../../gen/road-profile';
import { dirFrom, nodeKind } from '../../gen/road-geometry';
import type { ChunkSet } from '../kit/chunk-set';
import { CURB, HEIGHTS, PIECE } from '../kit/dims';
import { arcWall, at, flat, pieces, ring, slab, wallS } from '../kit/frame-shapes';
import type { EdgeSpan } from './edge-spans';
import { G, type GroundStyle } from './ground-style';

/**
 * Verges beside every carriageway: raised tiled sidewalks (the curb strip on their road edge is built by curbs.ts)
 * or flush paved aprons on sidewalk-less sois, continued around dead-end turnaround bulbs.
 */
export function buildSidewalks(spans: readonly EdgeSpan[], chunks: ChunkSet, style: GroundStyle): void {
  for (const S of spans) {
    const { F, hw, verge: v, raised } = S;
    for (const sp of S.sides) {
      if (sp.v1 - sp.v0 < 0.05) continue;
      const inner = hw + (raised ? CURB.width : 0);
      const l0 = sp.side > 0 ? inner : -hw - v;
      const l1 = sp.side > 0 ? hw + v : -inner;
      const freeStart = S.exitA && sp.v0 < 0;
      const freeEnd = S.exitB && sp.v1 > S.e.length;
      for (const [a, b] of pieces(sp.v0, sp.v1, PIECE)) {
        const mid = at(F, (a + b) / 2, (l0 + l1) / 2, 0);
        const mb = chunks.at(mid[0], mid[2]);
        if (raised) {
          mb.color(style.tiles).kind(G.tiles);
          flat(mb, F, a, b, l0, l1, HEIGHTS.sidewalk);
          mb.color(style.concrete).kind(G.concrete);
          slab(mb, F, a, b, l0, l1, HEIGHTS.lot, HEIGHTS.sidewalk, {
            top: false, lo: sp.side < 0, hi: sp.side > 0, start: freeStart && a === sp.v0, end: freeEnd && b === sp.v1,
          });
        } else {
          mb.color(style.pavers).kind(G.pavers);
          flat(mb, F, a, b, l0, l1, HEIGHTS.apron);
          mb.color(style.concrete).kind(G.concrete);
          const edge = sp.side > 0 ? l0 : l1;
          wallS(mb, F, a, b, edge, HEIGHTS.road, HEIGHTS.apron, sp.side > 0 ? -1 : 1);
          wallS(mb, F, a, b, sp.side > 0 ? l1 : l0, HEIGHTS.lot, HEIGHTS.apron, sp.side > 0 ? 1 : -1);
        }
      }
    }
  }
}

/** verge ring around each dead-end turnaround, open where the soi enters */
export function buildBulbVerges(nodes: readonly RoadNode[], edges: readonly RoadEdge[], bounds: Bounds2, chunks: ChunkSet, style: GroundStyle): void {
  for (const n of nodes) {
    if (nodeKind(nodes, edges, bounds, n.id) !== 'deadEnd') continue;
    const e = edges[n.edges[0]];
    const R = bulbRadius(e);
    const v = verge(e);
    const raised = e.sidewalk > 0;
    const d = dirFrom(e, n.id);
    const mouth = Math.atan2(d.z, d.x);
    const gap = Math.asin(Math.min(0.99, halfWidth(e) / R));
    const a0 = mouth + gap;
    const a1 = mouth + Math.PI * 2 - gap;
    const mb = chunks.at(n.pos.x, n.pos.z);
    const y = raised ? HEIGHTS.sidewalk : HEIGHTS.apron;
    mb.color(raised ? style.tiles : style.pavers).kind(raised ? G.tiles : G.pavers);
    ring(mb, n.pos.x, n.pos.z, R + (raised ? CURB.width : 0), R + v, a0, a1, y, 28);
    mb.color(style.concrete).kind(G.concrete);
    arcWall(mb, n.pos.x, n.pos.z, R + v, a0, a1, HEIGHTS.lot, y, 28, 1);
    if (!raised) arcWall(mb, n.pos.x, n.pos.z, R, a0, a1, HEIGHTS.road, y, 28, -1);
  }
}
