import type { Bounds2, OBB, RoadEdge, RoadNode, Vec2 } from '../../core/types';
import { headingOf } from '../../core/math2d';
import { frontageTrim, vergeTrim } from './corner-geometry';
import { buildingLine, halfWidth, verge } from './road-profile';
import { onBounds } from './road-geometry';

/**
 * One side of a road edge in a local frame: s = distance along the edge from node a, d = distance outward from
 * the centreline on this side. side +1 = left of a→b, −1 = right. Things standing on this side face the street
 * with heading `facing`.
 */
export interface SideFrame {
  e: RoadEdge;
  side: 1 | -1;
  o: Vec2;
  hw: number;
  verge: number;
  /** building line (facades stand here) */
  bl: number;
  facing: number;
  /** frontage span along s where facades may stand */
  f0: number;
  f1: number;
  /** span along s where the verge (sidewalk / apron) exists */
  v0: number;
  v1: number;
}

export function sideFrame(nodes: readonly RoadNode[], edges: readonly RoadEdge[], bounds: Bounds2, e: RoadEdge, side: 1 | -1): SideFrame {
  const exitA = nodes[e.a].edges.length === 1 && onBounds(nodes[e.a].pos, bounds);
  const exitB = nodes[e.b].edges.length === 1 && onBounds(nodes[e.b].pos, bounds);
  const toStreet = { x: -side * e.dir.z, z: side * e.dir.x };
  return {
    e, side, o: nodes[e.a].pos, hw: halfWidth(e), verge: verge(e), bl: buildingLine(e), facing: headingOf(toStreet),
    f0: frontageTrim(nodes, edges, e, e.a, side, exitA),
    f1: e.length - frontageTrim(nodes, edges, e, e.b, side, exitB),
    v0: Math.max(0, vergeTrim(nodes, edges, e, e.a, side)),
    v1: e.length - Math.max(0, vergeTrim(nodes, edges, e, e.b, side)),
  };
}

/** both sides of every edge, majors first (main, avenue, soi), then by edge id */
export function allSides(nodes: readonly RoadNode[], edges: readonly RoadEdge[], bounds: Bounds2): SideFrame[] {
  const rank = { main: 0, avenue: 1, soi: 2 } as const;
  const sorted = edges.slice().sort((p, q) => rank[p.cls] - rank[q.cls] || p.id - q.id);
  const out: SideFrame[] = [];
  for (const e of sorted) for (const side of [1, -1] as const) out.push(sideFrame(nodes, edges, bounds, e, side));
  return out;
}

/** world point at s along the edge, d metres out from the centreline on this side */
export function sidePoint(f: SideFrame, s: number, d: number): Vec2 {
  const l = f.side * d;
  return { x: f.o.x + f.e.dir.x * s + f.e.dir.z * l, z: f.o.z + f.e.dir.z * s - f.e.dir.x * l };
}

/** box spanning s0..s1 along the edge and d0..d1 outward, oriented to face the street */
export function sideBox(f: SideFrame, s0: number, s1: number, d0: number, d1: number): OBB {
  const c = sidePoint(f, (s0 + s1) / 2, (d0 + d1) / 2);
  return { cx: c.x, cz: c.z, hw: Math.abs(s1 - s0) / 2, hl: Math.abs(d1 - d0) / 2, angle: f.facing };
}

/** heading along the edge (a→b when dirSign = 1) */
export function alongHeading(f: SideFrame, dirSign = 1): number {
  return headingOf({ x: f.e.dir.x * dirSign, z: f.e.dir.z * dirSign });
}
