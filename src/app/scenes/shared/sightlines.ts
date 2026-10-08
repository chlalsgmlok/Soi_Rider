import { closestOnSegment, dist } from '../../../core/math2d';
import { type CityData, type CityQuery, type Placement, Surface, type Vec2 } from '../../../core/types';

/** a tree canopy (cylinder) or a building block (box behind its facade line) that can hide the hero */
interface Blocker {
  solid: boolean;
  /** bounding circle for the per-ray prefilter */
  cx: number;
  cz: number;
  br: number;
  bottom: number;
  top: number;
  inside(x: number, z: number): boolean;
}

/** tree canopies at scale 1 (prop GLB bounds): radius, underside, top (m) */
const CANOPIES: Record<string, [number, number, number]> = {
  prop_raintree: [5.3, 3.2, 9.1],
  prop_palm: [3.1, 5.2, 7.5],
};
/** building blocks at scale 1: half width, depth behind the facade line, roof height (m) */
const BLOCKS: Record<string, [number, number, number]> = {
  bld_shophouse_2f: [2.1, 10.1, 8.6],
  bld_shophouse_3f: [2.1, 10.1, 12.3],
  bld_shophouse_4f: [2.1, 10.1, 15.5],
  bld_minimart: [4.4, 12, 5.4],
  bld_mall: [16, 30, 18],
  bld_condo: [8, 16, 60],
  bld_office: [10, 20, 80],
  bld_temple: [9, 30, 14],
};
/** building raster cells no block accounts for count as the lowest roof */
const FALLBACK_ROOF = 8.6;
const STEP = 0.6;

function canopy(p: Placement, [r, bottom, top]: [number, number, number]): Blocker {
  const rr = r * p.scale;
  return {
    solid: false, cx: p.pos.x, cz: p.pos.z, br: rr, bottom: bottom * p.scale, top: top * p.scale,
    inside: (x, z) => (x - p.pos.x) ** 2 + (z - p.pos.z) ** 2 < rr * rr,
  };
}

function block(p: Placement, [hw, depth, top]: [number, number, number]): Blocker {
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const w = hw * p.scale;
  const d = depth * p.scale;
  return {
    solid: true, cx: p.pos.x - fx * d * 0.5, cz: p.pos.z - fz * d * 0.5, br: Math.hypot(w, d * 0.5), bottom: -1,
    top: top * p.scale,
    inside: (x, z) => {
      const dx = x - p.pos.x;
      const dz = z - p.pos.z;
      const along = dx * fx + dz * fz;
      return along < 0.3 && along > -d && Math.abs(dx * fz - dz * fx) < w;
    },
  };
}

/**
 * Line-of-sight test for backdrop cameras over a city: blocked by building blocks below their roofs and by tree
 * canopies. Built once per city; `clear(from, to, toY)` samples the segment every 0.6 m.
 */
export class Sightlines {
  private readonly blockers: Blocker[] = [];
  private readonly near: Blocker[] = [];

  constructor(private readonly query: CityQuery, data: CityData) {
    for (const p of data.placements) {
      const c = CANOPIES[p.asset];
      const b = BLOCKS[p.asset];
      if (c) this.blockers.push(canopy(p, c));
      else if (b) this.blockers.push(block(p, b));
    }
  }

  /** true when nothing blocks the segment from `from` (camera, y = height) to the ground point `to` lifted by `toY` */
  clear(from: { x: number; y: number; z: number }, to: Vec2, toY: number): boolean {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const n = Math.max(2, Math.ceil(Math.hypot(dx, dz) / STEP));
    const near = this.near;
    near.length = 0;
    for (const b of this.blockers) {
      const c = { x: b.cx, z: b.cz };
      if (dist(c, closestOnSegment(c, from, to).point) < b.br) near.push(b);
    }
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = from.x + dx * t;
      const z = from.z + dz * t;
      const y = from.y + (toY - from.y) * t;
      let covered = false;
      for (const b of near) {
        if (!b.inside(x, z)) continue;
        covered ||= b.solid;
        if (y > b.bottom && y < b.top) return false;
      }
      if (!covered && y < FALLBACK_ROOF && this.query.surfaceAt(x, z) === Surface.Building) return false;
    }
    return true;
  }
}
