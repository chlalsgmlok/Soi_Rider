import type { Vec2 } from '../../core/types';

const EPS = 1e-12;

/**
 * Converts shapes into runs of raster cells (cell centres inside the shape, boundaries inclusive) for a row-major
 * grid. Results live in reusable buffers: span k covers flat indices start[k]..end[k] inclusive. Rect rows are
 * solved with per-shape linear coefficients, so the per-row cost is a handful of multiply-adds.
 */
export class SpanScanner {
  start = new Int32Array(256);
  end = new Int32Array(256);

  constructor(readonly minX: number, readonly minZ: number, readonly cell: number, readonly cols: number, readonly rows: number) {}

  private push(n: number, r: number, x0: number, x1: number): number {
    const c0 = Math.max(0, Math.ceil((x0 - this.minX) / this.cell - 0.5));
    const c1 = Math.min(this.cols - 1, Math.floor((x1 - this.minX) / this.cell - 0.5));
    if (c0 > c1) return n;
    if (n === this.start.length) {
      const s = new Int32Array(n * 2);
      const e = new Int32Array(n * 2);
      s.set(this.start);
      e.set(this.end);
      this.start = s;
      this.end = e;
    }
    this.start[n] = r * this.cols + c0;
    this.end[n] = r * this.cols + c1;
    return n + 1;
  }

  /** spans of the local rect: origin o, unit dir d, s ∈ [s0, s1] along d, l ∈ [l0, l1] along left(d) = (d.z, −d.x) */
  rect(o: Vec2, d: Vec2, s0: number, s1: number, l0: number, l1: number): number {
    return this.rectXZ(o.x, o.z, d.x, d.z, s0, s1, l0, l1);
  }

  /** rect() with origin and direction as scalars (allocation-free callers) */
  rectXZ(ox: number, oz: number, dx: number, dz: number, s0: number, s1: number, l0: number, l1: number): number {
    const zs0 = dz * s0;
    const zs1 = dz * s1;
    const zl0 = -dx * l0;
    const zl1 = -dx * l1;
    const z0 = oz + Math.min(zs0, zs1) + Math.min(zl0, zl1);
    const z1 = oz + Math.max(zs0, zs1) + Math.max(zl0, zl1);
    const r0 = Math.max(0, Math.floor((z0 - this.minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((z1 - this.minZ) / this.cell));
    // px bounds as linear functions of pz: A from the s constraint (coefficient dx), B from the l constraint (dz)
    const aOk = Math.abs(dx) > EPS;
    const bOk = Math.abs(dz) > EPS;
    const aLo0 = aOk ? (dx > 0 ? s0 : s1) / dx : 0;
    const aHi0 = aOk ? (dx > 0 ? s1 : s0) / dx : 0;
    const aK = aOk ? -dz / dx : 0;
    const bLo0 = bOk ? (dz > 0 ? l0 : l1) / dz : 0;
    const bHi0 = bOk ? (dz > 0 ? l1 : l0) / dz : 0;
    const bK = bOk ? dx / dz : 0;
    let n = 0;
    for (let r = r0; r <= r1; r++) {
      const pz = this.minZ + (r + 0.5) * this.cell - oz;
      let lo = -Infinity;
      let hi = Infinity;
      if (aOk) {
        lo = aLo0 + aK * pz;
        hi = aHi0 + aK * pz;
      } else if (pz * dz < s0 - 1e-9 || pz * dz > s1 + 1e-9) continue;
      if (bOk) {
        lo = Math.max(lo, bLo0 + bK * pz);
        hi = Math.min(hi, bHi0 + bK * pz);
      } else if (-pz * dx < l0 - 1e-9 || -pz * dx > l1 + 1e-9) continue;
      if (lo <= hi) n = this.push(n, r, ox + lo, ox + hi);
    }
    return n;
  }

  /** spans of a circle */
  circle(cx: number, cz: number, rad: number): number {
    const r0 = Math.max(0, Math.floor((cz - rad - this.minZ) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((cz + rad - this.minZ) / this.cell));
    let n = 0;
    for (let r = r0; r <= r1; r++) {
      const dz = this.minZ + (r + 0.5) * this.cell - cz;
      const h2 = rad * rad - dz * dz;
      if (h2 < 0) continue;
      const h = Math.sqrt(h2);
      n = this.push(n, r, cx - h, cx + h);
    }
    return n;
  }
}
