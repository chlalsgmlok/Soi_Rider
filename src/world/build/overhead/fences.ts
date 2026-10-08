import type { Frontage } from '../../../core/types';
import { type BatchItem, worldItem } from '../kit/batch';
import { ChunkSet } from '../kit/chunk-set';
import { HEIGHTS } from '../kit/dims';
import { type GroundFrame, pieces, slab } from '../kit/frame-shapes';
import type { MeshBuilder } from '../kit/mesh-builder';
import { kindCode, TINT } from '../templates/material-rules';

const PLAIN = kindCode(TINT.none, 0);
const BASE = HEIGHTS.lot;

/** whitewashed wat wall with a red tiled coping and gold knobs */
function templeWall(mb: MeshBuilder, F: GroundFrame, a: number, b: number): void {
  mb.color('#c9bfae').surf(0.9).kind(PLAIN);
  slab(mb, F, a, b, -0.2, 0.2, BASE, 0.35);
  mb.color('#f3eee3').surf(0.85);
  slab(mb, F, a, b, -0.16, 0.16, 0.35, 1.45, { top: false });
  mb.color('#b8312a').surf(0.6);
  slab(mb, F, a, b, -0.24, 0.24, 1.45, 1.58);
  mb.color('#e8b640').surf(0.35, 0.4);
  for (let s = a + 0.4; s < b - 0.3; s += 2.6) slab(mb, F, s - 0.1, s + 0.1, -0.1, 0.1, 1.58, 1.82);
}

/** park railing: kerb, posts and green pickets */
function parkRail(mb: MeshBuilder, F: GroundFrame, a: number, b: number): void {
  mb.color('#b9b2a8').surf(0.9).kind(PLAIN);
  slab(mb, F, a, b, -0.14, 0.14, BASE, 0.32);
  mb.color('#2f6b3d').surf(0.5, 0.2);
  for (let s = a + 0.1; s < b - 0.05; s += 2) slab(mb, F, s - 0.05, s + 0.05, -0.05, 0.05, 0.32, 1.25);
  for (const y of [0.42, 1.12]) slab(mb, F, a, b, -0.03, 0.03, y, y + 0.05);
  for (let s = a + 0.2; s < b - 0.1; s += 0.22) slab(mb, F, s - 0.015, s + 0.015, -0.015, 0.015, 0.32, 1.18, { top: false });
}

/** tower forecourt: low cream wall with a dark rail */
function towerWall(mb: MeshBuilder, F: GroundFrame, a: number, b: number): void {
  mb.color('#e9e2d4').surf(0.85).kind(PLAIN);
  slab(mb, F, a, b, -0.15, 0.15, BASE, 0.75);
  mb.color('#2a2c31').surf(0.45, 0.3);
  for (let s = a + 0.1; s < b - 0.05; s += 1.6) slab(mb, F, s - 0.03, s + 0.03, -0.03, 0.03, 0.75, 1.3);
  slab(mb, F, a, b, -0.035, 0.035, 1.26, 1.32);
}

/** lot fences the generator marks as frontages (temple walls, park railings, tower forecourt walls) */
export function buildFences(frontages: readonly Frontage[]): BatchItem[] {
  const chunks = new ChunkSet();
  for (const f of frontages) {
    if (f.kind !== 'temple' && f.kind !== 'park' && f.kind !== 'tower') continue;
    const len = Math.hypot(f.b.x - f.a.x, f.b.z - f.a.z);
    if (len < 0.5) continue;
    const F: GroundFrame = { o: f.a, d: { x: (f.b.x - f.a.x) / len, z: (f.b.z - f.a.z) / len } };
    for (const [a, b] of pieces(0, len, 24)) {
      const m = (a + b) / 2;
      const mb = chunks.at(f.a.x + F.d.x * m, f.a.z + F.d.z * m);
      if (f.kind === 'temple') templeWall(mb, F, a, b);
      else if (f.kind === 'park') parkRail(mb, F, a, b);
      else towerWall(mb, F, a, b);
    }
  }
  return chunks.builders().map((b) => worldItem(b.toGeometry('uber')));
}
