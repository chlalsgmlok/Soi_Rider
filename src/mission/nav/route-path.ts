import type { Vec2 } from '../../core/types';

export interface PathProjection {
  /** arc length of the closest point */
  s: number;
  /** distance from the query point to the path */
  dist: number;
  /** index of the segment holding the closest point */
  seg: number;
}

/**
 * An immutable route polyline with cumulative arc lengths: point / tangent lookup by arc length, windowed nearest
 * point projection (no allocation) and decimated slices for the mini-map.
 */
export class RoutePath {
  readonly points: readonly Vec2[];
  /** cumulative arc length at every point (cum[0] = 0) */
  readonly cum: Float64Array;
  readonly length: number;

  constructor(points: readonly Vec2[]) {
    this.points = points.length > 0 ? points : [{ x: 0, z: 0 }];
    const cum = new Float64Array(this.points.length);
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z);
    }
    this.cum = cum;
    this.length = cum[cum.length - 1];
  }

  get end(): Vec2 {
    return this.points[this.points.length - 1];
  }

  /** index i of the segment [i, i+1] that holds arc length s */
  segmentAt(s: number): number {
    const { cum } = this;
    let lo = 0;
    let hi = Math.max(0, cum.length - 2);
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  pointAt(s: number, out: Vec2 = { x: 0, z: 0 }): Vec2 {
    const pts = this.points;
    if (pts.length === 1) return Object.assign(out, pts[0]);
    const i = this.segmentAt(s);
    const a = pts[i];
    const b = pts[i + 1];
    const l = this.cum[i + 1] - this.cum[i];
    const t = l > 1e-9 ? Math.min(1, Math.max(0, (s - this.cum[i]) / l)) : 0;
    out.x = a.x + (b.x - a.x) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  }

  /** unit direction of travel at arc length s */
  tangentAt(s: number, out: Vec2 = { x: 0, z: 1 }): Vec2 {
    const pts = this.points;
    if (pts.length < 2) return Object.assign(out, { x: 0, z: 1 });
    let i = this.segmentAt(s);
    while (i < pts.length - 2 && this.cum[i + 1] - this.cum[i] < 1e-6) i++;
    const dx = pts[i + 1].x - pts[i].x;
    const dz = pts[i + 1].z - pts[i].z;
    const l = Math.hypot(dx, dz) || 1;
    out.x = dx / l;
    out.z = dz / l;
    return out;
  }

  /** closest point to p on the segments overlapping the arc window [s0, s1] (whole path by default) */
  project(p: Vec2, out: PathProjection, s0 = 0, s1 = Infinity): PathProjection {
    const { points: pts, cum } = this;
    out.s = 0;
    out.seg = 0;
    out.dist = Math.hypot(p.x - pts[0].x, p.z - pts[0].z);
    if (pts.length < 2) return out;
    const first = this.segmentAt(Math.max(0, s0));
    let best = Infinity;
    for (let i = first; i < pts.length - 1 && cum[i] <= s1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const l2 = abx * abx + abz * abz;
      const t = l2 > 1e-12 ? Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2)) : 0;
      const d = Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
      if (d < best) {
        best = d;
        out.dist = d;
        out.seg = i;
        out.s = cum[i] + (cum[i + 1] - cum[i]) * t;
      }
    }
    return out;
  }

  /** the path from arc length `from` to the end, points ≥ `step` m apart, at most `max` points, written into `out` */
  slice(from: number, out: Vec2[], step = 4, max = 160): Vec2[] {
    out.length = 0;
    out.push(this.pointAt(from));
    let last = out[0];
    for (let i = this.segmentAt(from) + 1; i < this.points.length && out.length < max - 1; i++) {
      const p = this.points[i];
      if (Math.hypot(p.x - last.x, p.z - last.z) < step) continue;
      out.push(p);
      last = p;
    }
    const end = this.end;
    if (out[out.length - 1] !== end) out.push(end);
    return out;
  }
}
