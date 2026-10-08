import type { CityData, Vec2 } from '../../core/types';

/** paths whose centrelines come closer than this cross or merge (m) */
const CONFLICT_GAP = 2.4;
/** half width of the swept zone around a crossing (covers two bus bodies + the sagitta of a curve) */
const ZONE_RADIUS = 3.4;
const STEP = 0.5;

/** Where two connectors at the same junction cross or merge: arc-length zones on both paths. */
export interface Conflict {
  /** the other connector's track id */
  other: number;
  /** zone on this connector [from, to] (m) */
  z0: number;
  z1: number;
  /** zone on the other connector [from, to] (m) */
  o0: number;
  o1: number;
}

function distToPolyline(p: Vec2, pts: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const l2 = abx * abx + abz * abz;
    const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2)) : 0;
    const d = Math.hypot(p.x - a.x - abx * t, p.z - a.z - abz * t);
    if (d < best) best = d;
  }
  return best;
}

/** arc-length samples of a polyline */
function samples(pts: readonly Vec2[]): Array<{ s: number; p: Vec2 }> {
  const out: Array<{ s: number; p: Vec2 }> = [];
  let s0 = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let d = 0; d < len; d += STEP) out.push({ s: s0 + d, p: { x: a.x + ((b.x - a.x) * d) / len, z: a.z + ((b.z - a.z) * d) / len } });
    s0 += len;
  }
  const last = pts[pts.length - 1];
  out.push({ s: s0, p: { x: last.x, z: last.z } });
  return out;
}

/** [first, last] arc length of `mine` within `r` of `other`, or null */
function zone(mine: Array<{ s: number; p: Vec2 }>, other: readonly Vec2[], r: number): [number, number] | null {
  let z0 = -1;
  let z1 = -1;
  for (const { s, p } of mine) {
    if (distToPolyline(p, other) >= r) continue;
    if (z0 < 0) z0 = s;
    z1 = s;
  }
  return z0 < 0 ? null : [z0, z1];
}

/**
 * Conflict table per connector track: every other movement through the same junction whose path crosses, merges
 * with or diverges from it (siblings leaving the same lane share their first metres — a bike beside a car at the
 * stop line must not cut across it when their movements split).
 */
export function buildConflicts(city: CityData): Conflict[][] {
  const L = city.lanes.length;
  const table: Conflict[][] = city.connectors.map(() => []);
  const byNode = new Map<number, number[]>();
  for (const c of city.connectors) {
    const list = byNode.get(c.node) ?? [];
    list.push(c.id);
    byNode.set(c.node, list);
  }
  const sampled = city.connectors.map((c) => samples(c.points));
  for (const ids of byNode.values()) {
    for (let i = 0; i < ids.length; i++) {
      const a = city.connectors[ids[i]];
      for (let j = i + 1; j < ids.length; j++) {
        const b = city.connectors[ids[j]];
        if (!zone(sampled[a.id], b.points, CONFLICT_GAP)) continue;
        const za = zone(sampled[a.id], b.points, ZONE_RADIUS);
        const zb = zone(sampled[b.id], a.points, ZONE_RADIUS);
        if (!za || !zb) continue;
        table[a.id].push({ other: L + b.id, z0: za[0], z1: za[1], o0: zb[0], o1: zb[1] });
        table[b.id].push({ other: L + a.id, z0: zb[0], z1: zb[1], o0: za[0], o1: za[1] });
      }
    }
  }
  return table;
}
