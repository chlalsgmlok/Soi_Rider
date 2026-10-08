import type { Bounds2, RoadEdge, RoadNode } from '../../../core/types';
import { bulbRadius, halfWidth } from '../../gen/road-profile';
import { dirFrom, nodeKind } from '../../gen/road-geometry';
import type { ChunkSet } from '../kit/chunk-set';
import { GUTTER_W, HEIGHTS, PIECE } from '../kit/dims';
import { at, disc, flat } from '../kit/frame-shapes';
import type { EdgeSpan } from './edge-spans';
import { G, type GroundStyle } from './ground-style';

/** sorted unique breakpoints inside [a, b] */
function breaks(a: number, b: number, extra: readonly number[]): number[] {
  const set = new Set<number>([a, b]);
  for (const x of extra) if (x > a + 0.05 && x < b - 0.05) set.add(x);
  for (let s = a + PIECE; s < b - 1; s += PIECE) set.add(s);
  return [...set].sort((p, q) => p - q);
}

/**
 * Carriageways: asphalt from the edge frame (lane geometry exactly), a light concrete gutter strip along every curb,
 * turnaround discs at dead ends and corner squares at bends. Pieces are binned into ground chunks.
 */
export function buildRoadSurface(spans: readonly EdgeSpan[], chunks: ChunkSet, style: GroundStyle): void {
  for (const S of spans) {
    const { F, hw } = S;
    const [L, R] = S.sides;
    const cuts = breaks(S.s0, S.s1, [L.c0, L.c1, R.c0, R.c1]);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i];
      const b = cuts[i + 1];
      const mid = at(F, (a + b) / 2, 0, 0);
      const mb = chunks.at(mid[0], mid[2]);
      const gl = a >= L.c0 - 1e-6 && b <= L.c1 + 1e-6;
      const gr = a >= R.c0 - 1e-6 && b <= R.c1 + 1e-6;
      mb.color(style.asphalt).kind(G.asphalt);
      flat(mb, F, a, b, -hw + (gr ? GUTTER_W : 0), hw - (gl ? GUTTER_W : 0), HEIGHTS.road);
      mb.color(style.gutter).kind(G.gutter);
      if (gl) flat(mb, F, a, b, hw - GUTTER_W, hw, HEIGHTS.road);
      if (gr) flat(mb, F, a, b, -hw, -hw + GUTTER_W, HEIGHTS.road);
    }
  }
}

/** asphalt turnaround discs and the outer corner squares of bends */
export function buildNodeSurfaces(nodes: readonly RoadNode[], edges: readonly RoadEdge[], bounds: Bounds2, chunks: ChunkSet, style: GroundStyle): void {
  for (const n of nodes) {
    const kind = nodeKind(nodes, edges, bounds, n.id);
    const mb = chunks.at(n.pos.x, n.pos.z);
    mb.color(style.asphalt).kind(G.asphalt);
    if (kind === 'deadEnd') {
      disc(mb, n.pos.x, n.pos.z, bulbRadius(edges[n.edges[0]]), HEIGHTS.road, 28);
    } else if (kind === 'bend') {
      // both carriageways start at the node centre: fill the outer corner quadrant they leave open
      const [A, B] = n.edges.map((id) => edges[id]);
      const dA = dirFrom(A, n.id);
      const dB = dirFrom(B, n.id);
      const lat = dA.z * dB.x - dA.x * dB.z;
      const hA = halfWidth(A);
      flat(mb, { o: n.pos, d: dA }, -halfWidth(B), 0, lat > 0 ? -hA : 0, lat > 0 ? 0 : hA, HEIGHTS.road);
    }
  }
}
