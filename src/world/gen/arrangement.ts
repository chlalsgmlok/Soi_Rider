import type { Bounds2, RoadEdge, RoadNode, Vec2 } from '../../core/types';
import { ROAD_PROFILE } from './road-profile';
import type { Layout } from './layout-types';
import { crossV } from './seg-math';
import type { RoadNet } from './net-types';

const SNAP = 1.5;
const STUB = 12;

interface Split {
  t: number;
  node: number;
}

function intersect(a1: Vec2, b1: Vec2, a2: Vec2, b2: Vec2): { t: number; u: number; p: Vec2 } | null {
  const ex = b1.x - a1.x;
  const ez = b1.z - a1.z;
  const fx = b2.x - a2.x;
  const fz = b2.z - a2.z;
  const den = crossV(ex, ez, fx, fz);
  if (Math.abs(den) < 1e-9) return null;
  const wx = a2.x - a1.x;
  const wz = a2.z - a1.z;
  const t = crossV(wx, wz, fx, fz) / den;
  const u = crossV(wx, wz, ex, ez) / den;
  const tolT = 0.75 / Math.hypot(ex, ez);
  const tolU = 0.75 / Math.hypot(fx, fz);
  if (t < -tolT || t > 1 + tolT || u < -tolU || u > 1 + tolU) return null;
  return { t: Math.min(1, Math.max(0, t)), u: Math.min(1, Math.max(0, u)), p: { x: a1.x + ex * t, z: a1.z + ez * t } };
}

const onBoundary = (p: Vec2, b: Bounds2): boolean =>
  Math.abs(p.x - b.minX) < 0.75 || Math.abs(p.x - b.maxX) < 0.75 || Math.abs(p.z - b.minZ) < 0.75 || Math.abs(p.z - b.maxZ) < 0.75;

/**
 * Turn layout segments into a planar road graph: split at every crossing / T, snap coincident points, drop
 * overhang stubs, merge straight-through degree-2 nodes of the same line, then build RoadNode/RoadEdge records.
 */
export function arrange(layout: Layout, bounds: Bounds2): RoadNet {
  const pts: Vec2[] = [];
  const nodeAt = (p: Vec2): number => {
    for (let i = 0; i < pts.length; i++) if ((pts[i].x - p.x) ** 2 + (pts[i].z - p.z) ** 2 < SNAP * SNAP) return i;
    pts.push({ x: p.x, z: p.z });
    return pts.length - 1;
  };
  const segs = layout.segs;
  const splits: Split[][] = segs.map(() => []);
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const hit = intersect(segs[i].a, segs[i].b, segs[j].a, segs[j].b);
      if (!hit) continue;
      const node = nodeAt(hit.p);
      splits[i].push({ t: hit.t, node });
      splits[j].push({ t: hit.u, node });
    }
  }
  segs.forEach((s, i) => {
    splits[i].push({ t: 0, node: nodeAt(s.a) }, { t: 1, node: nodeAt(s.b) });
  });

  let raw: Array<{ a: number; b: number; line: number }> = [];
  const seen = new Set<string>();
  segs.forEach((s, i) => {
    const list = splits[i].sort((p, q) => p.t - q.t);
    for (let k = 1; k < list.length; k++) {
      const [a, b] = [list[k - 1].node, list[k].node];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      raw.push({ a, b, line: s.line });
    }
  });

  const len = (e: { a: number; b: number }): number => Math.hypot(pts[e.b].x - pts[e.a].x, pts[e.b].z - pts[e.a].z);
  const degree = (): number[] => {
    const d = new Array<number>(pts.length).fill(0);
    for (const e of raw) d[e.a]++, d[e.b]++;
    return d;
  };
  for (let changed = true; changed; ) {
    const d = degree();
    const before = raw.length;
    raw = raw.filter((e) => {
      const stubA = d[e.a] === 1 && !onBoundary(pts[e.a], bounds);
      const stubB = d[e.b] === 1 && !onBoundary(pts[e.b], bounds);
      return !((stubA || stubB) && len(e) < STUB);
    });
    changed = raw.length !== before;
  }
  for (let changed = true; changed; ) {
    changed = false;
    const d = degree();
    for (let n = 0; n < pts.length && !changed; n++) {
      if (d[n] !== 2) continue;
      const [e1, e2] = raw.filter((e) => e.a === n || e.b === n);
      if (e1.line !== e2.line) continue;
      const o1 = e1.a === n ? e1.b : e1.a;
      const o2 = e2.a === n ? e2.b : e2.a;
      const v1 = { x: pts[o1].x - pts[n].x, z: pts[o1].z - pts[n].z };
      const v2 = { x: pts[o2].x - pts[n].x, z: pts[o2].z - pts[n].z };
      if ((v1.x * v2.x + v1.z * v2.z) / (Math.hypot(v1.x, v1.z) * Math.hypot(v2.x, v2.z)) > -0.995) continue;
      raw = raw.filter((e) => e !== e1 && e !== e2);
      raw.push(e1.b === n ? { a: e1.a, b: o2, line: e1.line } : { a: o2, b: e1.b === n ? e1.a : e1.b, line: e1.line });
      changed = true;
    }
  }
  return buildRecords(raw, pts, layout, bounds);
}

function buildRecords(raw: Array<{ a: number; b: number; line: number }>, pts: Vec2[], layout: Layout, bounds: Bounds2): RoadNet {
  const used = new Map<number, number>();
  const nodes: RoadNode[] = [];
  const idOf = (p: number): number => {
    let id = used.get(p);
    if (id === undefined) {
      id = nodes.length;
      used.set(p, id);
      nodes.push({ id, pos: { x: pts[p].x, z: pts[p].z }, edges: [], signal: false, radius: 0 });
    }
    return id;
  };
  const edges: RoadEdge[] = [];
  const edgeLine: number[] = [];
  for (const r of raw) {
    const line = layout.lines[r.line];
    const [a, b] = [idOf(r.a), idOf(r.b)];
    const dx = nodes[b].pos.x - nodes[a].pos.x;
    const dz = nodes[b].pos.z - nodes[a].pos.z;
    const length = Math.hypot(dx, dz);
    const p = ROAD_PROFILE[line.cls];
    const id = edges.length;
    edges.push({
      id, a, b, cls: line.cls, oneWay: false, lanesAB: p.lanes, lanesBA: p.lanes, laneWidth: p.laneWidth,
      median: p.median, sidewalk: p.sidewalk, skytrain: line.skytrain, length, dir: { x: dx / length, z: dz / length },
      name: line.name, nameTh: line.nameTh,
    });
    edgeLine.push(r.line);
    nodes[a].edges.push(id);
    nodes[b].edges.push(id);
  }
  return {
    bounds, nodes, edges, edgeLine, lines: layout.lines, openings: new Set(),
    trims: new Float64Array(edges.length * 2),
  };
}
