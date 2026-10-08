import type { Vec2 } from '../../../core/types';
import type { ChunkSet } from '../kit/chunk-set';
import { PIECE } from '../kit/dims';
import type { P3 } from '../kit/mesh-builder';
import type { UvRect } from './markings-atlas';

/** height of painted markings above the asphalt (the material also uses polygon offset) */
export const MARK_Y = 0.012;
const UP: P3 = [0, 1, 0];

/**
 * A flat glyph centred at (cx, cz) whose "up" points along unit (fx, fz) (the way a driver reads it), `width` across
 * and `length` along it, at height y. The glyph's left edge lies on the reader's left.
 */
export function glyph(chunks: ChunkSet, cx: number, cz: number, fx: number, fz: number, width: number, length: number, uv: UvRect, y = MARK_Y): void {
  const rx = -fz;
  const rz = fx;
  const hl = length / 2;
  const hw = width / 2;
  const p = (a: number, b: number): P3 => [cx + fx * a + rx * b, y, cz + fz * a + rz * b];
  chunks.at(cx, cz).quad(p(-hl, -hw), p(-hl, hw), p(hl, hw), p(hl, -hw), UP, uv);
}

/** a painted stripe of `width` from a to b (long runs split so every piece stays in its chunk) */
export function stripe(chunks: ChunkSet, a: Vec2, b: Vec2, width: number, uv: UvRect, y = MARK_Y): void {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 1e-3) return;
  const fx = (b.x - a.x) / len;
  const fz = (b.z - a.z) / len;
  const n = Math.max(1, Math.ceil(len / PIECE));
  for (let i = 0; i < n; i++) {
    const m = ((i + 0.5) / n) * len;
    glyph(chunks, a.x + fx * m, a.z + fz * m, fx, fz, width, len / n, uv, y);
  }
}

/** dashed stripe along a → b: `dash` metres painted every `period` metres, starting `phase` metres in */
export function dashes(chunks: ChunkSet, a: Vec2, b: Vec2, width: number, dash: number, period: number, uv: UvRect, phase = 0): void {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < dash) return;
  const dx = (b.x - a.x) / len;
  const dz = (b.z - a.z) / len;
  for (let s = phase; s + dash <= len + 1e-6; s += period) {
    stripe(chunks, { x: a.x + dx * s, z: a.z + dz * s }, { x: a.x + dx * (s + dash), z: a.z + dz * (s + dash) }, width, uv);
  }
}
