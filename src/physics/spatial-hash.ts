/**
 * Uniform-grid spatial hash for dynamic 2D items (XZ plane). Items are inserted with their bounds; queries return
 * each overlapping item once. Rebuild per step with `clear()` + `insert()` — buckets are pooled, so steady-state
 * use does not allocate. Cell keys are exact for |cell index| < 32768 (cell 2 m → ±65 km).
 */
export class SpatialHash<T> {
  private readonly cells = new Map<number, T[]>();
  private readonly used: T[][] = [];
  private readonly pool: T[][] = [];
  private readonly seen = new Set<T>();
  private readonly inv: number;

  constructor(readonly cellSize = 4) {
    if (!(cellSize > 0)) throw new Error('[SpatialHash] cellSize must be > 0');
    this.inv = 1 / cellSize;
  }

  private key(ix: number, iz: number): number {
    return (ix + 32768) * 65536 + (iz + 32768);
  }

  /** remove every item (buckets go back to the pool) */
  clear(): void {
    for (const b of this.used) {
      b.length = 0;
      this.pool.push(b);
    }
    this.used.length = 0;
    this.cells.clear();
  }

  insert(item: T, minX: number, minZ: number, maxX: number, maxZ: number): void {
    const x0 = Math.floor(minX * this.inv);
    const x1 = Math.floor(maxX * this.inv);
    const z0 = Math.floor(minZ * this.inv);
    const z1 = Math.floor(maxZ * this.inv);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let b = this.cells.get(k);
        if (!b) {
          b = this.pool.pop() ?? [];
          this.cells.set(k, b);
          this.used.push(b);
        }
        b.push(item);
      }
    }
  }

  /** insert by centre + radius */
  insertCircle(item: T, x: number, z: number, r: number): void {
    this.insert(item, x - r, z - r, x + r, z + r);
  }

  /** fills `out` (cleared first) with items whose cells touch the rect; returns the count */
  query(minX: number, minZ: number, maxX: number, maxZ: number, out: T[]): number {
    out.length = 0;
    this.seen.clear();
    const x0 = Math.floor(minX * this.inv);
    const x1 = Math.floor(maxX * this.inv);
    const z0 = Math.floor(minZ * this.inv);
    const z1 = Math.floor(maxZ * this.inv);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const b = this.cells.get(this.key(ix, iz));
        if (!b) continue;
        for (const it of b) {
          if (this.seen.has(it)) continue;
          this.seen.add(it);
          out.push(it);
        }
      }
    }
    return out.length;
  }

  queryCircle(x: number, z: number, r: number, out: T[]): number {
    return this.query(x - r, z - r, x + r, z + r, out);
  }

  /** number of occupied cells (diagnostics) */
  get cellCount(): number {
    return this.cells.size;
  }
}
