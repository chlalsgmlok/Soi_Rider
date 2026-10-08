import type { CityData, TurnKind, Vec2 } from '../../core/types';
import { angleDiff, clamp, headingOf } from '../../core/math2d';

/** lateral acceleration NPCs accept in turns (m/s²) */
const TURN_LAT_ACCEL = 2.4;

/**
 * One drivable piece of the network: every lane is a track (id = lane id) and every connector is a track
 * (id = lanes.length + connector id). Vehicles move along tracks by arc length `s`.
 */
export interface Track {
  readonly id: number;
  /** lane id, or -1 for a connector */
  readonly lane: number;
  /** connector id, or -1 for a lane */
  readonly connector: number;
  readonly pts: readonly Vec2[];
  /** cumulative arc length at each point */
  readonly cum: Float64Array;
  /** heading of each segment */
  readonly segH: Float64Array;
  readonly length: number;
  /** successor tracks (lane → its out connectors, connector → its target lane) */
  readonly next: readonly number[];
  /** node the track ends at (lane) / crosses (connector) */
  readonly node: number;
  readonly width: number;
  /** comfortable speed (lane speed limit; connectors limited by curvature) */
  readonly speedLimit: number;
  readonly turn: TurnKind | null;
  /** road edge (lanes; connectors report their source lane's edge) */
  readonly edge: number;
}

/** reusable pose output */
export interface Pose {
  x: number;
  z: number;
  h: number;
}

function cumulative(pts: readonly Vec2[]): Float64Array {
  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return cum;
}

function headings(pts: readonly Vec2[]): Float64Array {
  const h = new Float64Array(Math.max(1, pts.length - 1));
  for (let i = 0; i + 1 < pts.length; i++) h[i] = headingOf({ x: pts[i + 1].x - pts[i].x, z: pts[i + 1].z - pts[i].z });
  return h;
}

/** Lanes + connectors as one track graph with arc-length sampling. */
export class Tracks {
  readonly list: Track[] = [];
  readonly laneCount: number;
  /** lanes of the same edge and direction, ordered by lane index (0 = inner) — keyed by lane id */
  readonly siblings: ReadonlyArray<readonly number[]>;

  constructor(readonly city: CityData) {
    const { lanes, connectors, edges } = city;
    this.laneCount = lanes.length;
    for (const l of lanes) {
      const pts = [l.start, l.end];
      const e = edges[l.edge];
      this.list.push({
        id: l.id, lane: l.id, connector: -1, pts, cum: cumulative(pts), segH: headings(pts), length: l.length,
        next: l.out.map((c) => lanes.length + c), node: l.forward ? e.b : e.a, width: l.width, speedLimit: l.speedLimit,
        turn: null, edge: l.edge,
      });
    }
    for (const c of connectors) {
      const from = lanes[c.from];
      const to = lanes[c.to];
      const turned = Math.abs(angleDiff(headingOf(from.dir), headingOf(to.dir)));
      const radius = turned > 0.05 ? c.length / turned : Infinity;
      const v = clamp(Math.sqrt(TURN_LAT_ACCEL * radius), 2.6, Math.min(from.speedLimit, to.speedLimit));
      this.list.push({
        id: lanes.length + c.id, lane: -1, connector: c.id, pts: c.points, cum: cumulative(c.points), segH: headings(c.points),
        length: Math.max(0.1, c.length), next: [c.to], node: c.node, width: Math.min(from.width, to.width), speedLimit: v,
        turn: c.turn, edge: from.edge,
      });
    }
    const groups = new Map<string, number[]>();
    for (const l of lanes) {
      const key = `${l.edge}:${l.forward ? 1 : 0}`;
      const g = groups.get(key) ?? [];
      g[l.index] = l.id;
      groups.set(key, g);
    }
    this.siblings = lanes.map((l) => groups.get(`${l.edge}:${l.forward ? 1 : 0}`) ?? [l.id]);
  }

  get(id: number): Track {
    return this.list[id];
  }

  isLane(id: number): boolean {
    return id < this.laneCount;
  }

  connectorTrack(connectorId: number): number {
    return this.laneCount + connectorId;
  }

  /** segment index containing arc length s */
  segment(t: Track, s: number): number {
    const cum = t.cum;
    const n = cum.length - 1;
    if (n <= 1 || s <= cum[1]) return 0;
    if (s >= cum[n - 1]) return n - 1;
    let lo = 1;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** centreline point + heading at arc length s, shifted `lat` metres to the LEFT of travel */
  sample(id: number, s: number, lat: number, out: Pose): Pose {
    const t = this.list[id];
    const i = this.segment(t, s);
    const a = t.pts[i];
    const b = t.pts[i + 1] ?? a;
    const segLen = t.cum[i + 1] - t.cum[i];
    const u = segLen > 1e-9 ? clamp((s - t.cum[i]) / segLen, -20, 21) : 0;
    const h = t.segH[i];
    // left(θ) = (cos θ, −sin θ)
    out.x = a.x + (b.x - a.x) * u + Math.cos(h) * lat;
    out.z = a.z + (b.z - a.z) * u - Math.sin(h) * lat;
    out.h = h;
    return out;
  }

  /** heading change rate (rad/m) around s on a connector — 0 on lanes */
  curvature(id: number, s: number): number {
    const t = this.list[id];
    if (t.segH.length < 2) return 0;
    const i = this.segment(t, s);
    const j = Math.min(t.segH.length - 1, i + 1);
    const k = Math.max(0, i - 1);
    const ds = Math.max(0.2, t.cum[j + 1] - t.cum[k]);
    return angleDiff(t.segH[k], t.segH[j]) / ds;
  }
}
