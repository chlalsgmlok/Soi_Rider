import type { Bounds2 } from '../../core/types';

/**
 * Static uniform-grid index of integer ids by AABB, stored CSR-style (offsets + flat ids) for cache-friendly,
 * allocation-free queries. `collect` writes unique ids into `out` and returns their count.
 */
export class GridIndex {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  private readonly minX: number;
  private readonly minZ: number;
  private pending: number[][] | null;
  private offsets = new Int32Array(1);
  private ids = new Int32Array(0);
  private stamp: Uint32Array;
  private tick = 0;
  /** query results (valid up to the returned count) */
  out: Int32Array;

  constructor(bounds: Bounds2, cell: number, itemCount: number) {
    this.cell = cell;
    this.minX = bounds.minX;
    this.minZ = bounds.minZ;
    this.cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell));
    this.rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell));
    this.pending = Array.from({ length: this.cols * this.rows }, () => []);
    this.stamp = new Uint32Array(Math.max(1, itemCount));
    this.out = new Int32Array(64);
  }

  private readonly r4: [number, number, number, number] = [0, 0, 0, 0];

  /** cell range of an AABB, clamped into the grid (items and queries beyond the bounds use the border cells) */
  private range(minX: number, minZ: number, maxX: number, maxZ: number): [number, number, number, number] {
    const r = this.r4;
    r[0] = Math.min(this.cols - 1, Math.max(0, Math.floor((minX - this.minX) / this.cell)));
    r[1] = Math.min(this.rows - 1, Math.max(0, Math.floor((minZ - this.minZ) / this.cell)));
    r[2] = Math.min(this.cols - 1, Math.max(0, Math.floor((maxX - this.minX) / this.cell)));
    r[3] = Math.min(this.rows - 1, Math.max(0, Math.floor((maxZ - this.minZ) / this.cell)));
    return r;
  }

  insert(id: number, minX: number, minZ: number, maxX: number, maxZ: number): void {
    const cells = this.pending;
    if (!cells) throw new Error('GridIndex.insert after finalize');
    const [c0, r0, c1, r1] = this.range(minX, minZ, maxX, maxZ);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cells[r * this.cols + c].push(id);
  }

  finalize(): this {
    const cells = this.pending ?? [];
    this.offsets = new Int32Array(cells.length + 1);
    let total = 0;
    cells.forEach((list, i) => {
      this.offsets[i] = total;
      total += list.length;
    });
    this.offsets[cells.length] = total;
    this.ids = new Int32Array(total);
    cells.forEach((list, i) => this.ids.set(list, this.offsets[i]));
    this.pending = null;
    return this;
  }

  /** unique ids of items whose inserted AABB shares a cell with the query AABB */
  collect(minX: number, minZ: number, maxX: number, maxZ: number): number {
    const [c0, r0, c1, r1] = this.range(minX, minZ, maxX, maxZ);
    if (c0 > c1 || r0 > r1) return 0;
    if (++this.tick === 0xffffffff) {
      this.stamp.fill(0);
      this.tick = 1;
    }
    let n = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const k = r * this.cols + c;
        for (let j = this.offsets[k]; j < this.offsets[k + 1]; j++) {
          const id = this.ids[j];
          if (this.stamp[id] === this.tick) continue;
          this.stamp[id] = this.tick;
          if (n === this.out.length) {
            const grown = new Int32Array(n * 2);
            grown.set(this.out);
            this.out = grown;
          }
          this.out[n++] = id;
        }
      }
    }
    return n;
  }
}
