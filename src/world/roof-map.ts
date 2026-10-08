import type { Bounds2, CityData } from '../core/types';

/** [facade width, depth behind the facade, roof height] of each building model at scale 1 (docs/ASSET_SPEC.md) */
export const ROOF_SIZES: Readonly<Record<string, readonly [number, number, number]>> = {
  bld_shophouse_2f: [4, 10, 7.5],
  bld_shophouse_3f: [4, 10, 10.5],
  bld_shophouse_4f: [4, 10, 13.5],
  bld_minimart: [8, 12, 4.5],
  bld_mall: [32, 30, 18],
  bld_condo: [16, 16, 60],
  bld_office: [20, 20, 80],
  bld_temple: [18, 30, 14],
  bts_station: [60, 18, 17],
};

/** building cells no placement claims (lot fillers, row ends) are assumed this tall */
export const DEFAULT_ROOF = 12;
/** balconies, awnings and vertical shop signs reach this far over the pavement in front of a facade (m) */
export const FACADE_REACH = 2;
const CELL = 1;

/**
 * Roof heights (m) on a 1 m raster, rasterised from the building placements' footprints (the facade sits on the
 * placement position, the body extends behind it; FACADE_REACH in front of it covers balconies, awnings and signs). Lets chase cameras see over 2–3 storey shophouses the way
 * mockup 03 does while still respecting towers. 0 = no building placement covers the cell.
 */
export class RoofMap {
  private readonly cols: number;
  private readonly rows: number;
  private readonly data: Uint8Array;

  constructor(private readonly bounds: Bounds2, city: CityData) {
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 1;
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / CELL) + 1;
    this.data = new Uint8Array(this.cols * this.rows);
    for (const p of city.placements) {
      const size = ROOF_SIZES[p.asset];
      if (!size) continue;
      const [w, d, h] = size;
      this.stamp(p.pos.x, p.pos.z, p.heading, (w * p.scale) / 2, (d * p.scale) / 2, h * p.scale);
    }
  }

  /** roof height at a world point (0 when no building placement covers it) */
  at(x: number, z: number): number {
    const c = Math.floor((x - this.bounds.minX) / CELL);
    const r = Math.floor((z - this.bounds.minZ) / CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0;
    return this.data[r * this.cols + c];
  }

  /** fill an oriented rectangle: body `2·hd` deep behind the facade at (fx, fz) plus FACADE_REACH in front of it */
  private stamp(fx: number, fz: number, heading: number, hw: number, bodyHalf: number, height: number): void {
    const sx = Math.sin(heading);
    const cz = Math.cos(heading);
    const hd = bodyHalf + FACADE_REACH / 2;
    const cx = fx - sx * (bodyHalf * 2 - hd);
    const cy = fz - cz * (bodyHalf * 2 - hd);
    const reach = Math.hypot(hw, hd);
    const h = Math.min(255, Math.round(height));
    const c0 = Math.max(0, Math.floor((cx - reach - this.bounds.minX) / CELL));
    const c1 = Math.min(this.cols - 1, Math.ceil((cx + reach - this.bounds.minX) / CELL));
    const r0 = Math.max(0, Math.floor((cy - reach - this.bounds.minZ) / CELL));
    const r1 = Math.min(this.rows - 1, Math.ceil((cy + reach - this.bounds.minZ) / CELL));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = this.bounds.minX + (c + 0.5) * CELL - cx;
        const dz = this.bounds.minZ + (r + 0.5) * CELL - cy;
        const along = dx * sx + dz * cz;
        const across = -dx * cz + dz * sx;
        if (Math.abs(along) > hd || Math.abs(across) > hw) continue;
        const i = r * this.cols + c;
        if (h > this.data[i]) this.data[i] = h;
      }
    }
  }
}
