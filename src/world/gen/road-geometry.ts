import type { Bounds2, Lane, RoadEdge, RoadNode, Vec2 } from '../../core/types';

/**
 * Shared road-geometry helpers. Used by the generator, the surface raster and src/world/build so that markings,
 * curbs and the SurfaceMap agree exactly. Edge-local frame: s along dir from node a, l along leftOf(dir).
 */

/** unit direction pointing away from node n along edge e */
export function dirFrom(e: RoadEdge, n: number): Vec2 {
  return e.a === n ? e.dir : { x: -e.dir.x, z: -e.dir.z };
}

export function otherEnd(e: RoadEdge, n: number): number {
  return e.a === n ? e.b : e.a;
}

/** left-hand normal of a direction (the side Thai traffic keeps to) */
export function leftOfDir(d: Vec2): Vec2 {
  return { x: d.z, z: -d.x };
}

/** world point at edge-local (s along, l to the left of a→b) */
export function edgePoint(nodes: readonly RoadNode[], e: RoadEdge, s: number, l: number): Vec2 {
  const a = nodes[e.a].pos;
  return { x: a.x + e.dir.x * s + e.dir.z * l, z: a.z + e.dir.z * s - e.dir.x * l };
}

export function onBounds(p: Vec2, b: Bounds2, eps = 0.75): boolean {
  return (
    Math.abs(p.x - b.minX) < eps || Math.abs(p.x - b.maxX) < eps ||
    Math.abs(p.z - b.minZ) < eps || Math.abs(p.z - b.maxZ) < eps
  );
}

export type NodeKind = 'junction' | 'deadEnd' | 'exit' | 'opening' | 'bend';

/**
 * junction (≥3 roads) · deadEnd (soi turnaround) · exit (road leaves the playable square — traffic portal)
 * · opening (median U-turn gap on a main road) · bend (two roads meeting at an angle)
 */
export function nodeKind(nodes: readonly RoadNode[], edges: readonly RoadEdge[], bounds: Bounds2, id: number): NodeKind {
  const n = nodes[id];
  if (n.edges.length === 1) return onBounds(n.pos, bounds) ? 'exit' : 'deadEnd';
  if (n.edges.length >= 3) return 'junction';
  const [e1, e2] = n.edges.map((x) => edges[x]);
  const d1 = dirFrom(e1, id);
  const d2 = dirFrom(e2, id);
  const straight = d1.x * d2.x + d1.z * d2.z < -0.99;
  return straight && e1.cls === 'main' && e2.cls === 'main' ? 'opening' : 'bend';
}

/** nodes where roads leave the playable square (spawn/despawn portals for traffic) */
export function exitNodes(nodes: readonly RoadNode[], bounds: Bounds2): number[] {
  return nodes.filter((n) => n.edges.length === 1 && onBounds(n.pos, bounds)).map((n) => n.id);
}

/**
 * Lane trims per edge end recovered from the lanes ([2·e] at a, [2·e+1] at b): how far from each node the lanes
 * (and lane markings / stop lines) stop.
 */
export function edgeTrims(edges: readonly RoadEdge[], lanes: readonly Lane[], nodes: readonly RoadNode[]): Float64Array {
  const out = new Float64Array(edges.length * 2);
  for (const ln of lanes) {
    const e = edges[ln.edge];
    const a = nodes[e.a].pos;
    const sOf = (p: Vec2): number => (p.x - a.x) * e.dir.x + (p.z - a.z) * e.dir.z;
    const first = ln.forward ? ln.start : ln.end;
    const last = ln.forward ? ln.end : ln.start;
    out[e.id * 2] = sOf(first);
    out[e.id * 2 + 1] = e.length - sOf(last);
  }
  return out;
}

/**
 * Signal phase groups at a node: approaches whose roads are roughly parallel share a group (0, 1, 2…).
 * Returns edge id → group.
 */
export function approachGroups(nodes: readonly RoadNode[], edges: readonly RoadEdge[], nodeId: number): Map<number, number> {
  const groups = new Map<number, number>();
  const axes: Vec2[] = [];
  for (const id of nodes[nodeId].edges) {
    const d = dirFrom(edges[id], nodeId);
    let g = axes.findIndex((a) => Math.abs(a.x * d.z - a.z * d.x) < 0.5);
    if (g < 0) {
      g = axes.length;
      axes.push(d);
    }
    groups.set(id, g);
  }
  return groups;
}
