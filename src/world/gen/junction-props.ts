import type { RoadEdge, Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { headingOf } from '../../core/math2d';
import { vergeTrim } from './corner-geometry';
import { arriving } from './movement';
import type { RoadNet } from './net-types';
import { ON_VERGE, type PlaceCtx } from './place-ctx';
import { halfWidth, verge } from './road-profile';
import { approachGroups, dirFrom } from './road-geometry';

const trimAt = (net: RoadNet, e: RoadEdge, n: number): number => net.trims[e.a === n ? e.id * 2 : e.id * 2 + 1];

/** point at distance s from node n along edge e, `out` metres to the LEFT of the direction away from n */
function besideEdge(net: RoadNet, e: RoadEdge, n: number, s: number, out: number): Vec2 {
  const d = dirFrom(e, n);
  const p = net.nodes[n].pos;
  return { x: p.x + d.x * s + d.z * out, z: p.z + d.z * s - d.x * out };
}

/**
 * Mast-arm signals: one per approach of every signalised junction, on the arriving traffic's left kerb at the
 * stop line, arm over the lanes, heads facing the approaching traffic (model heading = travel heading − π/2).
 * meta: node, edge (approach), group (signal phase group of that approach).
 */
export function placeTrafficLights(net: RoadNet, ctx: PlaceCtx): void {
  for (const n of net.nodes) {
    if (!n.signal) continue;
    const groups = approachGroups(net.nodes, net.edges, n.id);
    for (const id of n.edges) {
      const e = net.edges[id];
      if (arriving(e, n.id) === 0) continue;
      const away = dirFrom(e, n.id);
      const heading = headingOf({ x: -away.x, z: -away.z }) - Math.PI / 2;
      const meta = { node: String(n.id), edge: String(e.id), group: String(groups.get(id) ?? 0) };
      const t = trimAt(net, e, n.id);
      for (const ds of [0.6, 1.6, 2.8, 4]) {
        const pos = besideEdge(net, e, n.id, t + ds, -(halfWidth(e) + Math.min(0.6, verge(e) / 2)));
        if (ctx.prop('prop_traffic_light', pos, heading, ON_VERGE, 1, meta)) break;
      }
    }
  }
}

/**
 * Blue soi name signs at every soi mouth: on the corner reached first by main-road traffic turning in from the
 * near (curb) lane, plate facing that traffic. meta: text (English name), textTh (Thai name).
 */
export function placeSoiSigns(net: RoadNet, ctx: PlaceCtx, rng: Rng): void {
  for (const e of net.edges) {
    if (e.cls !== 'soi') continue;
    const parentLine = net.lines[net.edgeLine[e.id]]?.parent ?? -1;
    for (const n of [e.a, e.b]) {
      const node = net.nodes[n];
      const parentEdge = node.edges.map((id) => net.edges[id]).find((g) => g.id !== e.id && net.edgeLine[g.id] === parentLine);
      if (!parentEdge || node.edges.length < 3) continue;
      const into = dirFrom(e, n);
      const axis = dirFrom(parentEdge, n);
      const T = axis.z * into.x - axis.x * into.z > 0 ? axis : { x: -axis.x, z: -axis.z };
      const heading = headingOf({ x: -T.x, z: -T.z });
      const meta = { text: e.name, textTh: e.nameTh };
      for (const side of [1, -1]) {
        const s = Math.max(0, vergeTrim(net.nodes, net.edges, e, n, n === e.a ? side : -side)) + 0.9 + rng.range(0, 0.6);
        const pos = besideEdge(net, e, n, s, side * (halfWidth(e) + verge(e) / 2));
        if ((pos.x - node.pos.x) * -T.x + (pos.z - node.pos.z) * -T.z <= 0) continue;
        ctx.prop('prop_soi_sign', pos, heading, ON_VERGE, 1, meta);
      }
    }
  }
}
