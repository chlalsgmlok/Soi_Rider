import { Matrix4 } from 'three';
import type { CityData } from '../../../core/types';
import type { UvRect } from '../markings/markings-atlas';
import type { ChunkSet } from '../kit/chunk-set';
import { poseMatrix } from '../templates/placement-matrix';
import { GLOW } from './sign-content';
import { templePlaque } from './sign-designs';
import type { SignPainter } from './sign-paint-kit';
import { emitLocalQuad } from './sign-geometry';

const m = new Matrix4();

/**
 * Lacquer-red name plaques with gold lettering on the wat walls, either side of the temple gate.
 * Returns the number of plaques.
 */
export function buildTemplePlaques(data: CityData, chunks: ChunkSet, cell: (key: string, w: number, h: number, paint: SignPainter) => UvRect): number {
  let count = 0;
  for (const t of data.placements) {
    if (t.asset !== 'bld_temple' || !t.meta?.sign) continue;
    const rect = cell(`plaque|${t.meta.sign}`, 200, 60, templePlaque(t.meta.sign));
    const walls = data.frontages.filter((f) => f.kind === 'temple' && Math.hypot(f.a.x - t.pos.x, f.a.z - t.pos.z) < 60);
    for (const f of walls) {
      const len = Math.hypot(f.b.x - f.a.x, f.b.z - f.a.z);
      if (len < 3) continue;
      const da = Math.hypot(f.a.x - t.pos.x, f.a.z - t.pos.z);
      const db = Math.hypot(f.b.x - t.pos.x, f.b.z - t.pos.z);
      const [gate, other] = da < db ? [f.a, f.b] : [f.b, f.a];
      const k = 1.4 / len;
      const x = gate.x + (other.x - gate.x) * k;
      const z = gate.z + (other.z - gate.z) * k;
      poseMatrix(x, 0, z, f.heading, 1, m);
      emitLocalQuad(chunks.at(x, z), m, [[-0.9, 0.62, 0.25], [0.9, 0.62, 0.25], [0.9, 1.22, 0.25], [-0.9, 1.22, 0.25]], [0, 0, 1], rect, '#ffffff', GLOW.plate);
      count++;
    }
  }
  return count;
}
