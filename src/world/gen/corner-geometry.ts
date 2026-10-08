import type { RoadEdge, RoadNode } from '../../core/types';
import { buildingLine, bulbRadius, halfWidth, verge } from './road-profile';
import { dirFrom, leftOfDir } from './road-geometry';

/**
 * Corner geometry at a node for one side of an edge. sideAB = +1 → the left side of a→b, −1 → the right side.
 * All results are distances from the node along the edge.
 */

interface SideRoad {
  f: RoadEdge;
  /** |sin| and |cos| of the angle between the two roads */
  sin: number;
  cos: number;
}

function sideRoads(nodes: readonly RoadNode[], edges: readonly RoadEdge[], e: RoadEdge, n: number, sideAB: number) {
  const d = dirFrom(e, n);
  const left = leftOfDir(d);
  const sideD = e.a === n ? sideAB : -sideAB;
  const onSide: SideRoad[] = [];
  let straight = false;
  const others: RoadEdge[] = [];
  for (const fid of nodes[n].edges) {
    if (fid === e.id) continue;
    const f = edges[fid];
    const df = dirFrom(f, n);
    const dot = d.x * df.x + d.z * df.z;
    const lat = left.x * df.x + left.z * df.z;
    others.push(f);
    if (dot < -0.9) straight = true;
    else if (lat * sideD > 0.2) onSide.push({ f, sin: Math.max(0.3, Math.abs(lat)), cos: Math.abs(dot) });
  }
  return { onSide, straight, others, deg: nodes[n].edges.length };
}

/** where the verge (sidewalk / apron) stops before a crossing carriageway; negative = runs past the node (bend) */
export function vergeTrim(nodes: readonly RoadNode[], edges: readonly RoadEdge[], e: RoadEdge, n: number, sideAB: number): number {
  const { onSide, straight, others, deg } = sideRoads(nodes, edges, e, n, sideAB);
  if (deg === 1) return 0;
  if (onSide.length > 0) {
    const outer = halfWidth(e) + verge(e);
    return Math.max(...onSide.map((r) => (halfWidth(r.f) + outer * r.cos) / r.sin));
  }
  if (!straight && deg === 2) return -Math.max(...others.map((f) => halfWidth(f) + verge(f)));
  return 0;
}

/** where facades along this side may begin (corner clearance for building rows) */
export function frontageTrim(nodes: readonly RoadNode[], edges: readonly RoadEdge[], e: RoadEdge, n: number, sideAB: number, exit: boolean): number {
  const { onSide, deg } = sideRoads(nodes, edges, e, n, sideAB);
  if (deg === 1) return exit ? 0 : bulbRadius(e) + verge(e) + 0.5;
  if (onSide.length === 0) return 0;
  return Math.max(...onSide.map((r) => (buildingLine(r.f) + buildingLine(e) * r.cos) / r.sin));
}

/** where a raised median stops at node n: through unsignalised soi mouths it continues (left-in / left-out only) */
export function medianTrim(node: RoadNode, laneTrim: number): number {
  return node.signal || node.edges.length <= 2 ? laneTrim : 0;
}
