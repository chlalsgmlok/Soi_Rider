import type { Bounds2, Circle, ColliderTag, Frontage, OBB, Placement, StaticCollider, Vec2 } from '../../core/types';
import { Surface } from '../../core/types';
import type { Rng } from '../../core/rng';
import { SurfaceMap, surfaceMask } from '../surface-map';
import { footprintOf } from './asset-footprints';
import type { LaneClearance } from './lane-clearance';
import { obbAllWith, paintObb } from './obb-paint';
import { BUILDING_OVER, LOT_OVER } from './surface-build';

/** surface masks a footprint may stand on */
export const ON_VERGE = surfaceMask(Surface.Sidewalk, Surface.Plaza);
export const ON_GROUND = surfaceMask(Surface.Void);
export const ON_LOT = surfaceMask(Surface.Void, Surface.Plaza);
export const ON_MEDIAN = surfaceMask(Surface.Median);
const FREE = surfaceMask(0);
const CORNER_U = [0, 1, -1, 1, -1];
const CORNER_V = [0, 1, 1, -1, -1];

export interface Solid {
  tag: ColliderTag;
  circle?: Circle;
  obb?: OBB;
}

export interface AddOpts {
  scale?: number;
  meta?: Record<string, string>;
  collider?: number | null;
}

/**
 * Mutable placement state shared by the dressing stages: the surface raster (buildings + lot plazas are painted
 * into it as they are placed), a prop keep-out raster, exact lane clearance, and the output arrays.
 */
export class PlaceCtx {
  readonly placements: Placement[] = [];
  readonly colliders: StaticCollider[] = [];
  readonly frontages: Frontage[] = [];
  readonly occ: SurfaceMap;
  private readonly b: Bounds2;

  constructor(readonly surface: SurfaceMap, readonly lanes: LaneClearance, readonly rng: Rng) {
    this.b = { minX: surface.minX, minZ: surface.minZ, maxX: surface.minX + surface.cols * surface.cell, maxZ: surface.minZ + surface.rows * surface.cell };
    this.occ = new SurfaceMap(this.b, surface.cell);
  }

  /** point inside the playable square (grown by `margin`) */
  inside(x: number, z: number, margin = 0): boolean {
    return x >= this.b.minX - margin && x <= this.b.maxX + margin && z >= this.b.minZ - margin && z <= this.b.maxZ + margin;
  }

  variant(): number {
    return Math.floor(this.rng.next() * 0x7fffffff);
  }

  /** surface under the circle (and its centre cell) is allowed and no prop keep-out covers it */
  circleFree(x: number, z: number, r: number, allowed: number): boolean {
    if (!(allowed & (1 << this.surface.at(x, z))) || this.occ.at(x, z) !== 0) return false;
    return this.surface.circleAllWith(this.occ, x, z, r, allowed, FREE);
  }

  obbFree(o: OBB, allowed: number): boolean {
    if (!(allowed & (1 << this.surface.at(o.cx, o.cz))) || this.occ.at(o.cx, o.cz) !== 0) return false;
    return obbAllWith(this.surface, this.occ, o, allowed, FREE);
  }

  occupyCircle(x: number, z: number, r: number): void {
    this.occ.fillCircle(x, z, r, 1);
  }

  occupyObb(o: OBB, pad = 0): void {
    paintObb(this.occ, o, 1, -1, pad);
  }

  addCollider(s: Solid): number {
    const id = this.colliders.length;
    const c: StaticCollider = { id, tag: s.tag };
    if (s.circle) c.circle = s.circle;
    if (s.obb) c.obb = s.obb;
    this.colliders.push(c);
    return id;
  }

  add(asset: string, pos: Vec2, heading: number, o: AddOpts = {}): Placement {
    const p: Placement = {
      asset, pos: { x: pos.x, z: pos.z }, heading, scale: o.scale ?? 1, variant: this.variant(), collider: o.collider ?? null,
    };
    if (o.meta) p.meta = o.meta;
    this.placements.push(p);
    return p;
  }

  /**
   * Place a footprint-table prop if its solid base stands on `allowed` surfaces, clear of lanes and of other props'
   * keep-out areas; then reserve its own keep-out area. Returns null when it does not fit.
   */
  prop(asset: string, pos: Vec2, heading: number, allowed: number, scale = 1, meta?: Record<string, string>): Placement | null {
    const fp = footprintOf(asset);
    const col = fp.col;
    let solid: Solid | null = null;
    if (col && 'r' in col) solid = { tag: col.tag, circle: { cx: pos.x, cz: pos.z, r: col.r * scale } };
    else if (col) solid = { tag: col.tag, obb: { cx: pos.x, cz: pos.z, hw: (col.w / 2) * scale, hl: (col.l / 2) * scale, angle: heading } };
    if (!this.inside(pos.x, pos.z)) return null;
    const base = solid ?? { tag: 'furniture' as const, circle: { cx: pos.x, cz: pos.z, r: (typeof fp.keep === 'number' ? fp.keep : fp.keep[0] / 2) * scale } };
    if (base.circle ? !this.circleFree(pos.x, pos.z, base.circle.r, allowed) : !this.obbFree(base.obb as OBB, allowed)) return null;
    if (solid?.circle && !this.lanes.circleClear(pos.x, pos.z, solid.circle.r)) return null;
    if (solid?.obb && !this.lanes.obbClear(solid.obb)) return null;
    if (typeof fp.keep === 'number') this.occupyCircle(pos.x, pos.z, fp.keep * scale);
    else this.occupyObb({ cx: pos.x, cz: pos.z, hw: (fp.keep[0] / 2) * scale, hl: (fp.keep[1] / 2) * scale, angle: heading });
    return this.add(asset, pos, heading, { scale, meta, collider: solid ? this.addCollider(solid) : null });
  }

  /** cheap rejection: centre and the four (slightly inset) corners of a box */
  private cornersOk(o: OBB, allowed: number): boolean {
    const fx = Math.sin(o.angle);
    const fz = Math.cos(o.angle);
    const hw = Math.max(0, o.hw - 0.3);
    const hl = Math.max(0, o.hl - 0.3);
    for (let k = 0; k < 5; k++) {
      const u = CORNER_U[k];
      const v = CORNER_V[k];
      const x = o.cx - fz * hw * u + fx * hl * v;
      const z = o.cz + fx * hw * u + fz * hl * v;
      if (!this.inside(x, z, 1) || !(allowed & (1 << this.surface.at(x, z))) || this.occ.at(x, z) !== 0) return false;
    }
    return true;
  }

  /**
   * A building footprint fits on `allowed` surfaces, clear of props and lanes. Bare ground (Void) always lies at
   * least a verge (>= 0.7 m) away from any carriageway, so the exact lane test is only needed when paved lot
   * surfaces (Plaza, which includes the flush soi aprons) are allowed.
   */
  buildingFits(o: OBB, allowed = ON_GROUND): boolean {
    if (!this.cornersOk(o, allowed) || !obbAllWith(this.surface, this.occ, o, allowed, FREE)) return false;
    return allowed === ON_GROUND || this.lanes.obbClear(o, 0.3);
  }

  /** paint a building footprint into the surface raster (Building over Void/Plaza) */
  claimBuilding(o: OBB): void {
    paintObb(this.surface, o, Surface.Building, BUILDING_OVER);
  }

  /** paint a lot plaza (over Void only) */
  claimPlaza(o: OBB): void {
    paintObb(this.surface, o, Surface.Plaza, LOT_OVER);
  }
}
