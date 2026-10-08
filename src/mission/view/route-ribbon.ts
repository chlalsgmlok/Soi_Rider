import { BufferAttribute, BufferGeometry, DynamicDrawUsage } from 'three';
import type { Vec2 } from '../../core/types';
import type { RoutePath } from '../nav/route-path';
import { RIBBON_HALF } from './route-shader';

/** ground height lookup (CityView.groundHeight) */
export type GroundFn = (x: number, z: number) => number;

/** sample spacing along the route (m) */
export const RIBBON_STEP = 0.5;
/** height above the visual ground (m) — polygonOffset does the rest */
export const RIBBON_LIFT = 0.03;
/** tangents are taken over ± this many metres so corners turn smoothly */
const TANGENT_SPAN = 1;

/**
 * The route ribbon's BufferGeometry, rebuilt in place on every re-route: two vertices per sample (left / right of the
 * centre line, draped on the ground), uv = (across −1..1, arc metres). Buffers only grow (doubling), so a re-route
 * costs one pass over the samples and no allocation in the common case.
 */
export class RouteRibbon {
  readonly geometry = new BufferGeometry();
  private capacity = 0;
  private readonly a: Vec2 = { x: 0, z: 0 };
  private readonly b: Vec2 = { x: 0, z: 0 };
  private readonly c: Vec2 = { x: 0, z: 0 };

  build(path: RoutePath, ground: GroundFn): void {
    const len = path.length;
    const n = Math.max(2, Math.ceil(len / RIBBON_STEP) + 1);
    this.ensure(n);
    const pos = this.geometry.getAttribute('position') as BufferAttribute;
    const uv = this.geometry.getAttribute('uv') as BufferAttribute;
    const P = pos.array as Float32Array;
    const U = uv.array as Float32Array;
    const { a, b, c } = this;
    for (let i = 0; i < n; i++) {
      const s = Math.min(len, i * RIBBON_STEP);
      path.pointAt(s, c);
      path.pointAt(Math.max(0, s - TANGENT_SPAN), a);
      path.pointAt(Math.min(len, s + TANGENT_SPAN), b);
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      // left of the travel direction = (tz, −tx)
      const lx = tz * RIBBON_HALF;
      const lz = -tx * RIBBON_HALF;
      const y = ground(c.x, c.z) + RIBBON_LIFT;
      const o = i * 6;
      P[o] = c.x + lx;
      P[o + 1] = y;
      P[o + 2] = c.z + lz;
      P[o + 3] = c.x - lx;
      P[o + 4] = y;
      P[o + 5] = c.z - lz;
      const u = i * 4;
      U[u] = 1;
      U[u + 1] = s;
      U[u + 2] = -1;
      U[u + 3] = s;
    }
    pos.clearUpdateRanges();
    pos.addUpdateRange(0, n * 6);
    pos.needsUpdate = true;
    uv.clearUpdateRanges();
    uv.addUpdateRange(0, n * 4);
    uv.needsUpdate = true;
    this.geometry.setDrawRange(0, (n - 1) * 6);
    this.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.geometry.dispose();
  }

  /** grows the buffers to hold at least `samples` samples (and their quads) */
  private ensure(samples: number): void {
    if (samples <= this.capacity) return;
    const cap = Math.max(256, 1 << Math.ceil(Math.log2(samples)));
    const pos = new BufferAttribute(new Float32Array(cap * 6), 3).setUsage(DynamicDrawUsage);
    const uv = new BufferAttribute(new Float32Array(cap * 4), 2).setUsage(DynamicDrawUsage);
    const idx = new Uint32Array((cap - 1) * 6);
    for (let i = 0; i < cap - 1; i++) {
      const v = i * 2;
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
    this.geometry.dispose();
    this.geometry.setAttribute('position', pos);
    this.geometry.setAttribute('uv', uv);
    this.geometry.setIndex(new BufferAttribute(idx, 1));
    this.capacity = cap;
  }
}
