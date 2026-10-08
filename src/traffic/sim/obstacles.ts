import type { Bounds2 } from '../../core/types';

export type ObstacleKind = 'vehicle' | 'pedestrian' | 'player';

/** A moving body other agents must not drive or walk into (oriented box; pedestrians use hw = hl = radius). */
export interface Obstacle {
  kind: ObstacleKind;
  /** index into the owner's agent array (vehicles / pedestrians), -1 for the player */
  ref: number;
  x: number;
  z: number;
  h: number;
  /** unit forward (sin h, cos h) */
  fx: number;
  fz: number;
  hw: number;
  hl: number;
  /** signed speed along h (m/s) */
  speed: number;
  circle: boolean;
  /** vehicles must keep out of it (pedestrians only while on the carriageway) */
  solid: boolean;
}

const CELL = 8;

/**
 * Every agent and the player as obstacles in a uniform grid (8 m cells), rebuilt once per fixed step.
 * Bucketed by centre, so queries pad their box by the largest half extent they care about.
 */
export class Obstacles {
  readonly items: Obstacle[] = [];
  count = 0;
  private readonly cols: number;
  private readonly rows: number;
  private readonly minX: number;
  private readonly minZ: number;
  private readonly head: Int32Array;
  private next = new Int32Array(512);

  constructor(bounds: Bounds2) {
    this.minX = bounds.minX - 40;
    this.minZ = bounds.minZ - 40;
    this.cols = Math.ceil((bounds.maxX - bounds.minX + 80) / CELL);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ + 80) / CELL);
    this.head = new Int32Array(this.cols * this.rows).fill(-1);
  }

  begin(): void {
    this.count = 0;
  }

  add(kind: ObstacleKind, ref: number, x: number, z: number, h: number, hw: number, hl: number, speed: number, circle = false, solid = true): number {
    let o = this.items[this.count];
    if (!o) {
      o = { kind, ref, x, z, h, fx: Math.sin(h), fz: Math.cos(h), hw, hl, speed, circle, solid };
      this.items.push(o);
    } else {
      o.kind = kind;
      o.ref = ref;
      o.x = x;
      o.z = z;
      o.h = h;
      o.fx = Math.sin(h);
      o.fz = Math.cos(h);
      o.hw = hw;
      o.hl = hl;
      o.speed = speed;
      o.circle = circle;
      o.solid = solid;
    }
    return this.count++;
  }

  /** bucket every added obstacle */
  build(): void {
    this.head.fill(-1);
    if (this.next.length < this.count) this.next = new Int32Array(this.count * 2);
    for (let i = 0; i < this.count; i++) {
      const c = this.cellOf(this.items[i].x, this.items[i].z);
      this.next[i] = this.head[c];
      this.head[c] = i;
    }
  }

  /** indices of obstacles whose centre lies in the box, written to `out`; returns the count */
  query(x0: number, z0: number, x1: number, z1: number, out: number[]): number {
    const c0 = this.col(x0);
    const c1 = this.col(x1);
    const r0 = this.row(z0);
    const r1 = this.row(z1);
    let n = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (let i = this.head[r * this.cols + c]; i >= 0; i = this.next[i]) out[n++] = i;
      }
    }
    return n;
  }

  private col(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.minX) / CELL)));
  }

  private row(z: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.minZ) / CELL)));
  }

  private cellOf(x: number, z: number): number {
    return this.row(z) * this.cols + this.col(x);
  }
}
