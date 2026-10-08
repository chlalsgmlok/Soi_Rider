import type { Bounds2, RoadEdge, RoadNode } from '../../core/types';
import { Surface } from '../../core/types';
import type { SurfaceMap } from '../surface-map';
import { medianTrim, vergeTrim } from './corner-geometry';
import { bulbRadius, halfWidth, verge } from './road-profile';
import { dirFrom, onBounds } from './road-geometry';

/** crosswalk band at signalised junctions, measured back from the stop line (lane trim) */
export const CROSSWALK_FROM = 4.0;
export const CROSSWALK_TO = 0.8;

/**
 * Rasterise the road network: verges (sidewalk or flush apron) → dead-end bulbs → carriageways → intersection
 * boxes → raised medians → crosswalks at signals. `trims` = lane trims per edge end ([2e] at a, [2e+1] at b).
 */
export function paintNetwork(map: SurfaceMap, nodes: readonly RoadNode[], edges: readonly RoadEdge[], trims: Float64Array, bounds: Bounds2): void {
  const trimAt = (e: RoadEdge, n: number): number => trims[e.a === n ? e.id * 2 : e.id * 2 + 1];
  const deadEnds = nodes.filter((n) => n.edges.length === 1 && !onBounds(n.pos, bounds));

  for (const e of edges) {
    const a = nodes[e.a].pos;
    const hw = halfWidth(e);
    const v = verge(e);
    const code = e.sidewalk > 0 ? Surface.Sidewalk : Surface.Plaza;
    for (const side of [1, -1]) {
      const s0 = vergeTrim(nodes, edges, e, e.a, side);
      const s1 = e.length - vergeTrim(nodes, edges, e, e.b, side);
      if (side > 0) map.fillRect(a, e.dir, s0, s1, hw, hw + v, code);
      else map.fillRect(a, e.dir, s0, s1, -hw - v, -hw, code);
    }
  }
  for (const n of deadEnds) {
    const e = edges[n.edges[0]];
    map.fillCircle(n.pos.x, n.pos.z, bulbRadius(e) + verge(e), e.sidewalk > 0 ? Surface.Sidewalk : Surface.Plaza);
  }
  for (const e of edges) {
    const hw = halfWidth(e);
    map.fillRect(nodes[e.a].pos, e.dir, 0, e.length, -hw, hw, Surface.Road);
  }
  for (const n of deadEnds) map.fillCircle(n.pos.x, n.pos.z, bulbRadius(edges[n.edges[0]]), Surface.Road);
  for (const n of nodes) {
    if (n.edges.length < 3) continue;
    for (const id of n.edges) {
      const e = edges[id];
      const hw = halfWidth(e);
      map.fillRect(n.pos, dirFrom(e, n.id), 0, trimAt(e, n.id), -hw, hw, Surface.Intersection);
    }
  }
  for (const e of edges) {
    if (e.median <= 0) continue;
    const s0 = medianTrim(nodes[e.a], trimAt(e, e.a));
    const s1 = e.length - medianTrim(nodes[e.b], trimAt(e, e.b));
    map.fillRect(nodes[e.a].pos, e.dir, s0, s1, -e.median / 2, e.median / 2, Surface.Median);
  }
  for (const n of nodes) {
    if (!n.signal) continue;
    for (const id of n.edges) {
      const e = edges[id];
      const t = trimAt(e, n.id);
      const hw = halfWidth(e);
      map.fillRect(n.pos, dirFrom(e, n.id), t - CROSSWALK_FROM, t - CROSSWALK_TO, -hw, hw, Surface.Crosswalk);
    }
  }
}
