import type { Bounds2, RoadClass, Vec2 } from '../../core/types';
import type { LineRole, LineSpec, ReserveSpec, SegSpec } from './layout-types';
import { distToSeg, intersectRay, perpAt } from './seg-math';

/** half size of the playable square (m) */
export const HALF = 260;
/** minimum spacing between parallel roads (keeps blocks ≥ ~40 m once road widths are subtracted) */
export const PARALLEL_GAP = 34;
/** along-axis margin used when testing parallel spacing (collinear gaps shorter than this count as overlap) */
export const PARALLEL_MARGIN = 26;

export interface RegSeg extends SegSpec {
  horiz: boolean;
  cls: RoadClass;
}

export interface RayHit {
  t: number;
  seg: RegSeg;
}

interface Junction {
  along: number;
  side: number;
  major: boolean;
}

/** Canonical-frame registry of road lines, segments, junction spacing and reserved lots. */
export class LayoutBuilder {
  readonly lines: LineSpec[] = [];
  readonly segs: RegSeg[] = [];
  readonly reserves: ReserveSpec[] = [];
  private readonly junctions = new Map<number, Junction[]>();

  addLine(cls: RoadClass, role: LineRole, parent: number, side: number, along: number, skytrain = false): LineSpec {
    const line: LineSpec = { id: this.lines.length, cls, role, parent, side, along, skytrain, name: '', nameTh: '' };
    this.lines.push(line);
    return line;
  }

  addSeg(line: number, a: Vec2, b: Vec2): RegSeg {
    const seg: RegSeg = { a, b, line, horiz: Math.abs(b.x - a.x) >= Math.abs(b.z - a.z), cls: this.lines[line].cls };
    this.segs.push(seg);
    return seg;
  }

  segsOf(line: number): RegSeg[] {
    return this.segs.filter((s) => s.line === line);
  }

  addJunction(line: number, along: number, side: number, major: boolean): void {
    const list = this.junctions.get(line) ?? [];
    list.push({ along, side, major });
    this.junctions.set(line, list);
  }

  /** can a road meet `line` at `along` on `side`? majors need 42 m, same-side sois 36 m, opposite-side sois 14 m */
  mouthOK(line: number, along: number, side: number, major = false): boolean {
    for (const j of this.junctions.get(line) ?? []) {
      const gap = Math.abs(j.along - along);
      const need = j.major || major ? 42 : j.side === side || side === 0 || j.side === 0 ? 36 : 14;
      if (gap < need) return false;
    }
    return true;
  }

  /** segments crossed by the ray p0 + d·t for 3 < t ≤ tMax, sorted by t */
  cast(p0: Vec2, d: Vec2, tMax: number): RayHit[] {
    const hits: RayHit[] = [];
    for (const s of this.segs) {
      const t = intersectRay(p0, d, s);
      if (t !== null && t > 3 && t <= tMax) hits.push({ t, seg: s });
    }
    return hits.sort((p, q) => p.t - q.t);
  }

  /** distance along the ray to the first reserved lot inflated by `pad` (Infinity if none) */
  castReserve(p0: Vec2, d: Vec2, tMax: number, pad: number): number {
    let best = Infinity;
    for (const r of this.reserves) {
      let t0 = 0;
      let t1 = tMax;
      const lo = [r.rect.minX - pad, r.rect.minZ - pad];
      const hi = [r.rect.maxX + pad, r.rect.maxZ + pad];
      const o = [p0.x, p0.z];
      const v = [d.x, d.z];
      let hit = true;
      for (let k = 0; k < 2 && hit; k++) {
        if (Math.abs(v[k]) < 1e-9) {
          if (o[k] < lo[k] || o[k] > hi[k]) hit = false;
          continue;
        }
        const ta = (lo[k] - o[k]) / v[k];
        const tb = (hi[k] - o[k]) / v[k];
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
        if (t0 > t1) hit = false;
      }
      if (hit) best = Math.min(best, t0);
    }
    return best;
  }

  /** would segment a→b sit closer than `gap` to a parallel segment of another line? */
  parallelConflict(a: Vec2, b: Vec2, gap: number, ignoreLine: number): boolean {
    const horiz = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z);
    const al = (p: Vec2): number => (horiz ? p.x : p.z);
    const pp = (p: Vec2): number => (horiz ? p.z : p.x);
    const lo1 = Math.min(al(a), al(b));
    const hi1 = Math.max(al(a), al(b));
    for (const s of this.segs) {
      if (s.horiz !== horiz || s.line === ignoreLine) continue;
      const lo = Math.max(lo1, Math.min(al(s.a), al(s.b))) - PARALLEL_MARGIN;
      const hi = Math.min(hi1, Math.max(al(s.a), al(s.b))) + PARALLEL_MARGIN;
      if (lo > hi) continue;
      for (const q of [lo, (lo + hi) / 2, hi]) {
        if (Math.abs(perpAt(a, b, q, al, pp) - perpAt(s.a, s.b, q, al, pp)) < gap) return true;
      }
    }
    return false;
  }

  /** a rectangle overlapping another reserve (with spacing) */
  reserveClash(rect: Bounds2, pad: number): boolean {
    return this.reserves.some(
      (r) =>
        rect.minX < r.rect.maxX + pad && rect.maxX > r.rect.minX - pad &&
        rect.minZ < r.rect.maxZ + pad && rect.maxZ > r.rect.minZ - pad,
    );
  }

  /**
   * Snap dead-end tips of perpendicular sois onto a new segment: tips that stop short of it (≤ reach) are
   * extended, tips that overshoot it by ≤ reach are trimmed back, so no soi ends a few metres from a road.
   */
  snapTipsTo(target: RegSeg, reach: number): void {
    for (const s of this.segs) {
      if (s === target || s.horiz === target.horiz || s.cls !== 'soi') continue;
      for (const end of ['a', 'b'] as const) {
        const tip = s[end];
        const base = end === 'a' ? s.b : s.a;
        if (this.anchored(tip, s)) continue;
        const len = Math.hypot(tip.x - base.x, tip.z - base.z);
        const d = { x: (tip.x - base.x) / len, z: (tip.z - base.z) / len };
        const hit = intersectRay(base, d, target);
        if (hit !== null && hit > 4 && Math.abs(hit - len) <= reach) {
          s[end] = { x: base.x + d.x * hit, z: base.z + d.z * hit };
        }
      }
    }
  }

  /** is this endpoint attached to the boundary or another segment (i.e. not a free dead-end tip)? */
  anchored(p: Vec2, self: SegSpec): boolean {
    if (Math.abs(Math.abs(p.x) - HALF) < 0.5 || Math.abs(Math.abs(p.z) - HALF) < 0.5) return true;
    return this.segs.some((s) => s !== self && distToSeg(p, s) < 1);
  }
}

