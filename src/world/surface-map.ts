import type { Bounds2, SurfaceKind, Vec2 } from '../core/types';
import { Surface } from '../core/types';
import { SpanScanner } from './gen/raster-spans';

/** raster resolution (m per cell) */
export const SURFACE_CELL = 0.5;

/** bitmask of surface codes, e.g. surfaceMask(Surface.Road, Surface.Intersection) */
export const surfaceMask = (...codes: number[]): number => codes.reduce((m, c) => m | (1 << c), 0);

/** every code that a vehicle lane may occupy */
export const DRIVABLE = surfaceMask(Surface.Road, Surface.Intersection, Surface.Crosswalk);

/**
 * Uint8 raster of Surface codes over the city bounds, 0.5 m cells, row-major with rows along +z.
 * Rect helpers work in an oriented local frame: origin o, unit direction d, s along d, l along left(d) = (d.z, −d.x).
 * A cell belongs to a shape when its centre lies inside it (boundaries inclusive).
 */
export class SurfaceMap {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minZ: number;
  readonly data: Uint8Array;
  private readonly scan: SpanScanner;

  constructor(bounds: Bounds2, cell = SURFACE_CELL) {
    this.cell = cell;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.data = new Uint8Array(this.cols * this.rows);
    this.scan = new SpanScanner(this.minX, this.minZ, cell, this.cols, this.rows);
  }

  /** surface code at a world point (Void outside the raster) */
  at(x: number, z: number): SurfaceKind {
    const c = Math.floor((x - this.minX) / this.cell);
    const r = Math.floor((z - this.minZ) / this.cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return Surface.Void;
    return this.data[r * this.cols + c] as SurfaceKind;
  }

  private visit(n: number, fn: (i: number) => boolean | void): boolean {
    const { start, end } = this.scan;
    for (let k = 0; k < n; k++) for (let i = start[k]; i <= end[k]; i++) if (fn(i) === false) return false;
    return true;
  }

  private fill(n: number, code: number, over: number): void {
    const { start, end } = this.scan;
    const data = this.data;
    for (let k = 0; k < n; k++) {
      if (over === -1) data.fill(code, start[k], end[k] + 1);
      else for (let i = start[k]; i <= end[k]; i++) if (over & (1 << data[i])) data[i] = code;
    }
  }

  /** every scanned cell has a code in `allowed` here and (when given) a code in `otherAllowed` in `other` */
  private all(n: number, allowed: number, other: SurfaceMap | null, otherAllowed: number): boolean {
    const { start, end } = this.scan;
    const data = this.data;
    const od = other?.data;
    for (let k = 0; k < n; k++) {
      for (let i = start[k]; i <= end[k]; i++) {
        if (!(allowed & (1 << data[i]))) return false;
        if (od && !(otherAllowed & (1 << od[i]))) return false;
      }
    }
    return true;
  }

  /** visit cells inside the local rect; stops early (returns false) when fn returns false */
  forRect(o: Vec2, d: Vec2, s0: number, s1: number, l0: number, l1: number, fn: (i: number) => boolean | void): boolean {
    return this.visit(this.scan.rect(o, d, s0, s1, l0, l1), fn);
  }

  forCircle(cx: number, cz: number, rad: number, fn: (i: number) => boolean | void): boolean {
    return this.visit(this.scan.circle(cx, cz, rad), fn);
  }

  /** paint a local rect; when `over` is given only cells whose current code is in that mask are painted */
  fillRect(o: Vec2, d: Vec2, s0: number, s1: number, l0: number, l1: number, code: number, over = -1): void {
    this.fill(this.scan.rect(o, d, s0, s1, l0, l1), code, over);
  }

  fillCircle(cx: number, cz: number, rad: number, code: number, over = -1): void {
    this.fill(this.scan.circle(cx, cz, rad), code, over);
  }

  /** true if every cell in the rect has a code in `allowed` (bitmask); cells outside the raster are ignored */
  rectAll(o: Vec2, d: Vec2, s0: number, s1: number, l0: number, l1: number, allowed: number): boolean {
    return this.all(this.scan.rect(o, d, s0, s1, l0, l1), allowed, null, 0);
  }

  circleAll(cx: number, cz: number, rad: number, allowed: number): boolean {
    return this.all(this.scan.circle(cx, cz, rad), allowed, null, 0);
  }

  /** rectAll over this raster and a second raster of identical geometry in one pass */
  rectAllWith(other: SurfaceMap, o: Vec2, d: Vec2, s0: number, s1: number, l0: number, l1: number, allowed: number, otherAllowed: number): boolean {
    return this.all(this.scan.rect(o, d, s0, s1, l0, l1), allowed, other, otherAllowed);
  }

  /** paint an OBB (centre, heading, half extents; sim heading convention) without allocating */
  fillObb(cx: number, cz: number, angle: number, hw: number, hl: number, code: number, over = -1): void {
    this.fill(this.scan.rectXZ(cx, cz, Math.sin(angle), Math.cos(angle), -hl, hl, -hw, hw), code, over);
  }

  /** every cell under an OBB is allowed here (and in `other`, when given) */
  obbAllWith(other: SurfaceMap | null, cx: number, cz: number, angle: number, hw: number, hl: number, allowed: number, otherAllowed: number): boolean {
    return this.all(this.scan.rectXZ(cx, cz, Math.sin(angle), Math.cos(angle), -hl, hl, -hw, hw), allowed, other, otherAllowed);
  }

  circleAllWith(other: SurfaceMap, cx: number, cz: number, rad: number, allowed: number, otherAllowed: number): boolean {
    return this.all(this.scan.circle(cx, cz, rad), allowed, other, otherAllowed);
  }
}
