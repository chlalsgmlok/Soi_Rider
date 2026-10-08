import type { Connector, Lane, TurnKind } from '../../core/types';
import { polylineLength } from '../../core/math2d';
import { connectorPath } from './bezier';
import { DEAD_END_TRIM } from './junctions';
import type { LaneIndex } from './lanes';
import { movement } from './movement';
import type { RoadNet } from './net-types';
import { onBounds } from './road-geometry';

/** which movement kinds an approach has (decides how its lanes are split between them) */
export interface ApproachKinds {
  straight: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Lane pairs for a movement. Thai rules: straight from every lane (extra target lanes fed by the curb lane); with a
 * straight movement, left turns from the curb lane into the curb lane and right turns from the inner lane into the
 * inner lane; without one (T-junction stem) the approach splits — curb half turns left, inner half turns right —
 * so no lane is a trap. U-turns at a median opening from the inner lane, at dead ends / exits lane-for-lane.
 */
export function lanePairs(kind: TurnKind, nIn: number, nOut: number, opening: boolean, k: ApproachKinds): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  const half = nIn === 1 ? 0 : Math.floor(nIn / 2);
  if (kind === 'left') {
    if (k.straight) return [[nIn - 1, nOut - 1]];
    const first = k.right ? half : 0;
    for (let i = first; i < nIn; i++) pairs.push([i, Math.max(0, nOut - nIn + i)]);
    return pairs;
  }
  if (kind === 'right') {
    if (k.straight) return [[0, 0]];
    const last = k.left && nIn > 1 ? half : nIn;
    for (let i = 0; i < last; i++) pairs.push([i, Math.min(i, nOut - 1)]);
    return pairs;
  }
  if (kind === 'uturn' && opening) return [[0, 0]];
  for (let i = 0; i < nIn; i++) pairs.push([i, Math.min(i, nOut - 1)]);
  if (kind === 'straight') for (let j = nIn; j < nOut; j++) pairs.push([nIn - 1, j]);
  return pairs;
}

/** every legal movement at every node, as sampled Bézier paths from lane end to lane start */
export function buildConnectors(net: RoadNet, lanes: Lane[], index: LaneIndex): Connector[] {
  const out: Connector[] = [];
  for (const n of net.nodes) {
    const opening = net.openings.has(n.id);
    const deadEnd = n.edges.length === 1 && !onBounds(n.pos, net.bounds);
    for (const inId of n.edges) {
      const eIn = net.edges[inId];
      const ins = eIn.b === n.id ? index.fwd[inId] : index.back[inId];
      if (ins.length === 0) continue;
      const moves: Array<[number, TurnKind]> = [];
      for (const outId of n.edges) {
        const eOut = net.edges[outId];
        const outs = eOut.a === n.id ? index.fwd[outId] : index.back[outId];
        const kind = outs.length > 0 ? movement(net, n, eIn, eOut) : null;
        if (kind) moves.push([outId, kind]);
      }
      const kinds = { straight: moves.some((m) => m[1] === 'straight'), left: moves.some((m) => m[1] === 'left'), right: moves.some((m) => m[1] === 'right') };
      for (const [outId, kind] of moves) {
        const eOut = net.edges[outId];
        const outs = eOut.a === n.id ? index.fwd[outId] : index.back[outId];
        for (const [i, j] of lanePairs(kind, ins.length, outs.length, opening, kinds)) {
          const from = lanes[ins[i]];
          const to = lanes[outs[j]];
          const reach = kind === 'uturn' && deadEnd ? DEAD_END_TRIM : 0;
          const points = connectorPath(from.end, from.dir, to.start, to.dir, kind, reach);
          const id = out.length;
          out.push({ id, from: from.id, to: to.id, node: n.id, turn: kind, points, length: polylineLength(points) });
          from.out.push(id);
          to.in.push(id);
        }
      }
    }
  }
  return out;
}
