import type { CityQuery, RoadEdge, Vec2 } from '../../core/types';
import { Surface } from '../../core/types';
import { edgeTrims } from '../../world';
import { sideFrame, sidePoint, type SideFrame } from '../../world/gen/side-frame';

/** strip ends closer than this at a node are joined around the corner (m) */
const LINK_DIST = 9;
/** crosswalk band centre, measured back from the stop line (src/world CROSSWALK_FROM/TO = 4.0 … 0.8) */
const CROSSWALK_MID = 2.4;

/** A walkable band along one side of a road (sidewalk, or the flush apron of a soi). */
export interface Strip {
  id: number;
  frame: SideFrame;
  /** distance of the walking line from the road centreline */
  d: number;
  width: number;
  raised: boolean;
  s0: number;
  s1: number;
  /** links leaving each end: [at s0, at s1] */
  links: [Link[], Link[]];
  crossings: number[];
}

export interface Link {
  to: number;
  /** end of the target strip we arrive at (0 = s0, 1 = s1) */
  toEnd: 0 | 1;
  path: Vec2[];
}

/** a place to cross a road: signal crosswalk (walk phase) or informal soi-mouth crossing (gap acceptance) */
export interface Crossing {
  id: number;
  edge: number;
  /** signalised node whose walk phase guards it, or -1 */
  node: number;
  s: number;
  /** strip on the left (+1) / right (−1) side of the edge */
  left: number;
  right: number;
  a: Vec2;
  b: Vec2;
}

export interface SidewalkNet {
  strips: Strip[];
  crossings: Crossing[];
  /** strips per edge: [left, right] (-1 = none) */
  byEdge: Array<[number, number]>;
}

export function stripPoint(st: Strip, s: number, off: number): Vec2 {
  return sidePoint(st.frame, s, st.d + off);
}

function endPoint(st: Strip, end: 0 | 1): Vec2 {
  return stripPoint(st, end === 0 ? st.s0 : st.s1, 0);
}

/** true when the polyline stays off the carriageway (never crosses Road / Intersection cells) */
function offRoad(city: CityQuery, pts: readonly Vec2[]): boolean {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4));
    for (let k = 1; k < n; k++) {
      const s = city.surfaceAt(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n);
      if (s === Surface.Road || s === Surface.Intersection || s === Surface.Crosswalk) return false;
    }
  }
  return true;
}

function linkEnds(city: CityQuery, strips: Strip[], ends: Array<{ st: Strip; end: 0 | 1 }>): void {
  for (const a of ends) {
    for (const b of ends) {
      if (a.st === b.st || a.st.frame.e.id === b.st.frame.e.id) continue;
      const pa = endPoint(a.st, a.end);
      const pb = endPoint(b.st, b.end);
      if (Math.hypot(pa.x - pb.x, pa.z - pb.z) > LINK_DIST) continue;
      const corner = { x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 };
      const ea = a.st.frame.e.dir;
      const eb = b.st.frame.e.dir;
      const den = ea.x * eb.z - ea.z * eb.x;
      if (Math.abs(den) > 0.3) {
        const t = ((pb.x - pa.x) * eb.z - (pb.z - pa.z) * eb.x) / den;
        const c = { x: pa.x + ea.x * t, z: pa.z + ea.z * t };
        if (Math.hypot(c.x - pa.x, c.z - pa.z) < 7 && Math.hypot(c.x - pb.x, c.z - pb.z) < 7) Object.assign(corner, c);
      }
      const path = [pa, corner, pb];
      if (!offRoad(city, path)) continue;
      strips[a.st.id].links[a.end].push({ to: b.st.id, toEnd: b.end, path });
    }
  }
}

function addCrossing(net: SidewalkNet, e: RoadEdge, s: number, node: number): void {
  const [l, r] = net.byEdge[e.id];
  if (l < 0 || r < 0) return;
  const L = net.strips[l];
  const R = net.strips[r];
  if (s < Math.max(L.s0, R.s0) || s > Math.min(L.s1, R.s1)) return;
  const id = net.crossings.length;
  net.crossings.push({ id, edge: e.id, node, s, left: l, right: r, a: stripPoint(L, s, 0), b: stripPoint(R, s, 0) });
  L.crossings.push(id);
  R.crossings.push(id);
}

/**
 * Pedestrian network derived from the road graph: one strip per road side with a verge, corner links between
 * strips meeting at a junction (only where the walk stays off the carriageway), crosswalks across every arm of a
 * signalised junction and informal crossings at unsignalised soi mouths.
 */
export function buildSidewalkNet(city: CityQuery): SidewalkNet {
  const { nodes, edges, bounds, lanes } = city.data;
  const net: SidewalkNet = { strips: [], crossings: [], byEdge: edges.map(() => [-1, -1]) };
  for (const e of edges) {
    for (const side of [1, -1] as const) {
      const F = sideFrame(nodes, edges, bounds, e, side);
      if (F.v1 - F.v0 < 3) continue;
      const id = net.strips.length;
      net.strips.push({
        id, frame: F, d: F.hw + F.verge / 2, width: F.verge, raised: e.sidewalk > 0, s0: F.v0, s1: F.v1,
        links: [[], []], crossings: [],
      });
      net.byEdge[e.id][side > 0 ? 0 : 1] = id;
    }
  }
  const ends = new Map<number, Array<{ st: Strip; end: 0 | 1 }>>();
  for (const st of net.strips) {
    for (const end of [0, 1] as const) {
      const n = end === 0 ? st.frame.e.a : st.frame.e.b;
      const list = ends.get(n) ?? [];
      list.push({ st, end });
      ends.set(n, list);
    }
  }
  for (const list of ends.values()) linkEnds(city, net.strips, list);
  const trims = edgeTrims(edges, lanes, nodes);
  for (const n of nodes) {
    if (n.edges.length < 3) continue;
    for (const id of n.edges) {
      const e = edges[id];
      const t = trims[e.a === n.id ? id * 2 : id * 2 + 1];
      if (n.signal) {
        const back = t - CROSSWALK_MID;
        addCrossing(net, e, e.a === n.id ? back : e.length - back, n.id);
      } else if (e.median <= 0 && e.cls !== 'main') {
        const st = net.strips[net.byEdge[e.id][0]];
        if (!st) continue;
        addCrossing(net, e, e.a === n.id ? st.s0 + 1.4 : st.s1 - 1.4, -1);
      }
    }
  }
  return net;
}
