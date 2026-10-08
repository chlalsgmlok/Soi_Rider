import { Vector3 } from 'three';
import type { MeshBuilder } from '../kit/mesh-builder';

const T = new Vector3();
const N = new Vector3();
const B = new Vector3();
const UP = new Vector3(0, 1, 0);
const P = new Vector3();
const RING = 4;

/** point at t (0..1) on a sagging cable from a to b (parabolic approximation of the catenary) */
export function sagPoint(a: Vector3, b: Vector3, sag: number, t: number, out: Vector3): Vector3 {
  return out.lerpVectors(a, b, t).addScaledVector(UP, -sag * 4 * t * (1 - t));
}

/**
 * Low-poly cable (square section, `segs` segments) from a to b drooping by `sag` at mid-span, in the builder's
 * current colour / kind. Cheap enough for hundreds of spans.
 */
export function cable(mb: MeshBuilder, a: Vector3, b: Vector3, sag: number, radius: number, segs: number): void {
  const rings: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    sagPoint(a, b, sag, t, P);
    T.subVectors(b, a);
    T.y += -sag * 4 * (1 - 2 * t);
    T.normalize();
    N.crossVectors(T, UP);
    if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
    N.normalize();
    B.crossVectors(N, T).normalize();
    const base = mb.vertexCount;
    for (let k = 0; k < RING; k++) {
      const ang = (k / RING) * Math.PI * 2 + Math.PI / 4;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const nx = N.x * c + B.x * s;
      const ny = N.y * c + B.y * s;
      const nz = N.z * c + B.z * s;
      mb.vert(P.x + nx * radius, P.y + ny * radius, P.z + nz * radius, nx, ny, nz);
    }
    rings.push(base);
  }
  for (let i = 0; i < segs; i++) {
    const r0 = rings[i];
    const r1 = rings[i + 1];
    for (let k = 0; k < RING; k++) {
      const k1 = (k + 1) % RING;
      mb.tri(r0 + k, r1 + k, r1 + k1);
      mb.tri(r0 + k, r1 + k1, r0 + k1);
    }
  }
}
