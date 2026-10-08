import { Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { CityData, Lane } from '../../../core/types';
import { buildingLine } from '../../gen/road-profile';
import { edgeTrims } from '../../gen/road-geometry';
import { type BatchItem, worldItem } from '../kit/batch';
import { ChunkSet } from '../kit/chunk-set';
import { slab } from '../kit/frame-shapes';
import { EMIS, kindCode, MATTE_METAL, TINT } from '../templates/material-rules';
import { cable, sagPoint } from './catenary';

const SPACING = 12;
const a = new Vector3();
const b = new Vector3();
const p = new Vector3();

/**
 * Chinatown strings of red paper lanterns across the streets (district ambience.lanterns): a sagging wire from facade
 * to facade with a lantern every ~1.7 m; the lanterns glow red at night (neon emissive class).
 */
export function buildLanterns(data: CityData, lanes: readonly Lane[], rng: Rng): BatchItem[] {
  const chunks = new ChunkSet();
  const trims = edgeTrims(data.edges, lanes, data.nodes);
  for (const e of data.edges) {
    if (e.skytrain || e.cls === 'main') continue;
    const s0 = trims[e.id * 2] + 4;
    const s1 = e.length - trims[e.id * 2 + 1] - 4;
    const bl = buildingLine(e) - 0.2;
    const o = data.nodes[e.a].pos;
    const left = { x: e.dir.z, z: -e.dir.x };
    for (let s = s0 + rng.range(2, SPACING); s < s1; s += SPACING * rng.range(0.8, 1.2)) {
      const y = rng.range(6.0, 6.8);
      a.set(o.x + e.dir.x * s + left.x * bl, y, o.z + e.dir.z * s + left.z * bl);
      b.set(o.x + e.dir.x * s - left.x * bl, y + rng.range(-0.3, 0.3), o.z + e.dir.z * s - left.z * bl);
      const sag = rng.range(0.5, 0.9);
      const mb = chunks.at((a.x + b.x) / 2, (a.z + b.z) / 2);
      mb.color('#1c1d22').surf(0.8, MATTE_METAL).kind(kindCode(TINT.none, 0));
      cable(mb, a, b, sag, 0.012, 12);
      const n = Math.floor(a.distanceTo(b) / 1.7);
      for (let k = 1; k < n; k++) {
        sagPoint(a, b, sag, k / n, p);
        const F = { o: { x: p.x, z: p.z }, d: e.dir };
        mb.color('#1c1d22').kind(kindCode(TINT.none, 0));
        slab(mb, F, -0.01, 0.01, -0.01, 0.01, p.y - 0.18, p.y, { top: false });
        mb.color(rng.chance(0.85) ? '#e8241b' : '#f5b321').surf(0.6).kind(kindCode(TINT.none, EMIS.neon));
        slab(mb, F, -0.17, 0.17, -0.17, 0.17, p.y - 0.62, p.y - 0.2);
        slab(mb, F, -0.12, 0.12, -0.21, 0.21, p.y - 0.58, p.y - 0.24, { top: false });
        slab(mb, F, -0.21, 0.21, -0.12, 0.12, p.y - 0.58, p.y - 0.24, { top: false });
        mb.color('#e8b640').surf(0.4, 0.3).kind(kindCode(TINT.none, 0));
        slab(mb, F, -0.1, 0.1, -0.1, 0.1, p.y - 0.2, p.y - 0.16);
        slab(mb, F, -0.1, 0.1, -0.1, 0.1, p.y - 0.66, p.y - 0.62);
      }
    }
  }
  return chunks.builders().map((m) => worldItem(m.toGeometry('uber')));
}
