import type { Lane, RoadEdge, Vec2 } from '../../core/types';
import type { LaneIndex } from './lanes';
import type { RoadNet } from './net-types';

/** curb lane of an edge on `side` (+1 = left of a→b = forward lanes), or the other direction's on one-way roads */
export function curbLane(lanes: readonly Lane[], index: LaneIndex, e: RoadEdge, side: number): Lane | null {
  const pick = (ids: number[]): Lane | null => (ids.length ? lanes[ids[ids.length - 1]] : null);
  const near = side > 0 ? index.fwd[e.id] : index.back[e.id];
  const far = side > 0 ? index.back[e.id] : index.fwd[e.id];
  return pick(near) ?? pick(far);
}

/** which side of edge e point p lies on (+1 left of a→b, −1 right) */
export function sideOfEdge(net: RoadNet, e: RoadEdge, p: Vec2): number {
  const a = net.nodes[e.a].pos;
  return (p.x - a.x) * e.dir.z - (p.z - a.z) * e.dir.x >= 0 ? 1 : -1;
}

/** distance along a lane of the projection of p, kept `margin` metres inside the lane */
export function laneS(l: Lane, p: Vec2, margin = 3): number {
  const s = (p.x - l.start.x) * l.dir.x + (p.z - l.start.z) * l.dir.z;
  const m = Math.min(margin, l.length / 2);
  return Math.min(l.length - m, Math.max(m, s));
}
