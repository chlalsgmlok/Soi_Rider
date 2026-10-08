import type { Bounds2, RoadEdge, RoadNode } from '../../../core/types';
import { vergeTrim } from '../../gen/corner-geometry';
import { bulbRadius, halfWidth, verge } from '../../gen/road-profile';
import { onBounds } from '../../gen/road-geometry';
import { EXIT_EXTENSION } from '../kit/dims';
import type { GroundFrame } from '../kit/frame-shapes';

/** one side of an edge: where its verge (sidewalk / apron) and its curb run along s */
export interface SideSpan {
  side: 1 | -1;
  v0: number;
  v1: number;
  c0: number;
  c1: number;
}

/**
 * Cross-section + extents of an edge as the city view draws it (edge frame: s from node a along dir, l to the left).
 * Exit roads continue EXIT_EXTENSION beyond the playable square; dead ends stop at their turnaround bulb.
 */
export interface EdgeSpan {
  e: RoadEdge;
  F: GroundFrame;
  hw: number;
  verge: number;
  raised: boolean;
  /** carriageway extent along s */
  s0: number;
  s1: number;
  exitA: boolean;
  exitB: boolean;
  deadA: boolean;
  deadB: boolean;
  sides: [SideSpan, SideSpan];
}

const isExit = (n: RoadNode, b: Bounds2): boolean => n.edges.length === 1 && onBounds(n.pos, b);
const isDead = (n: RoadNode, b: Bounds2): boolean => n.edges.length === 1 && !onBounds(n.pos, b);

/** widest other carriageway at a node (outer corner of a bend) */
function otherHalf(nodes: readonly RoadNode[], edges: readonly RoadEdge[], e: RoadEdge, n: number): number {
  return Math.max(0, ...nodes[n].edges.filter((id) => id !== e.id).map((id) => halfWidth(edges[id])));
}

function sideSpan(nodes: readonly RoadNode[], edges: readonly RoadEdge[], S: Omit<EdgeSpan, 'sides'>, side: 1 | -1): SideSpan {
  const { e, hw } = S;
  const bulbCut = Math.sqrt(Math.max(0, bulbRadius(e) ** 2 - hw ** 2));
  const end = (n: number, exit: boolean, dead: boolean): [number, number] => {
    if (exit) return [-EXIT_EXTENSION, -EXIT_EXTENSION];
    if (dead) return [bulbCut, bulbCut];
    const t = vergeTrim(nodes, edges, e, n, side);
    if (t >= 0) return [t, t];
    return [t, -otherHalf(nodes, edges, e, n)];
  };
  const [va, ca] = end(e.a, S.exitA, S.deadA);
  const [vb, cb] = end(e.b, S.exitB, S.deadB);
  return { side, v0: va, v1: e.length - vb, c0: ca, c1: e.length - cb };
}

export function edgeSpan(nodes: readonly RoadNode[], edges: readonly RoadEdge[], bounds: Bounds2, e: RoadEdge): EdgeSpan {
  const na = nodes[e.a];
  const nb = nodes[e.b];
  const base: Omit<EdgeSpan, 'sides'> = {
    e, F: { o: na.pos, d: e.dir }, hw: halfWidth(e), verge: verge(e), raised: e.sidewalk > 0,
    exitA: isExit(na, bounds), exitB: isExit(nb, bounds), deadA: isDead(na, bounds), deadB: isDead(nb, bounds),
    s0: 0, s1: e.length,
  };
  if (base.exitA) base.s0 = -EXIT_EXTENSION;
  if (base.exitB) base.s1 = e.length + EXIT_EXTENSION;
  return { ...base, sides: [sideSpan(nodes, edges, base, 1), sideSpan(nodes, edges, base, -1)] };
}

export function edgeSpans(nodes: readonly RoadNode[], edges: readonly RoadEdge[], bounds: Bounds2): EdgeSpan[] {
  return edges.map((e) => edgeSpan(nodes, edges, bounds, e));
}
