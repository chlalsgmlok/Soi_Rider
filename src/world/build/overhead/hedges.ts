import type { Rng } from '../../../core/rng';
import type { Placement } from '../../../core/types';
import type { MedianRun } from '../ground/median-build';
import { type BatchItem, worldItem } from '../kit/batch';
import { ChunkSet } from '../kit/chunk-set';
import { CURB, HEIGHTS } from '../kit/dims';
import { blob } from '../kit/blob';
import { at } from '../kit/frame-shapes';
import { kindCode, MATTE_METAL, TINT } from '../templates/material-rules';

const GREENS = ['#3f8f3a', '#2f7a35', '#4fa33f', '#3a8a46'] as const;
const KEEP_CLEAR: Readonly<Record<string, number>> = { bts_pillar: 3.2, prop_palm: 1.1, prop_bougainvillea: 1.1, prop_raintree: 1.6 };

/**
 * Clipped shrub hedges along raised medians (gaps where the median carries palms, bougainvillea or a BTS pillar).
 * `density` = QualitySettings.propDensity.
 */
export function buildHedges(runs: readonly MedianRun[], placements: readonly Placement[], rng: Rng, density: number): BatchItem[] {
  const chunks = new ChunkSet();
  const blockers = placements.filter((p) => KEEP_CLEAR[p.asset] !== undefined);
  for (const { F, hl, hw } of runs) {
    const width = Math.min(1.15, 2 * hw - 2 * CURB.width - 0.35);
    if (width < 0.5) continue;
    const y0 = HEIGHTS.median;
    for (let s = -hl + 1.2; s < hl - 2.2; s += rng.range(2.1, 2.6)) {
      if (!rng.chance(0.55 + 0.4 * density)) continue;
      const len = rng.range(1.4, 1.9);
      const c = at(F, s + len / 2, 0, 0);
      if (blockers.some((p) => Math.hypot(p.pos.x - c[0], p.pos.z - c[2]) < KEEP_CLEAR[p.asset] + len / 2)) continue;
      const mb = chunks.at(c[0], c[2]);
      const h = rng.range(0.5, 0.7);
      const alongX = Math.abs(F.d.x) > Math.abs(F.d.z);
      for (let k = 0; k < 3; k++) {
        const p = at(F, s + len * (0.2 + 0.3 * k), rng.range(-0.05, 0.05), 0);
        const ra = (len / 3) * rng.range(0.85, 1.05);
        const rw = (width / 2) * rng.range(0.85, 1.0);
        mb.color(rng.pick(GREENS)).surf(0.75, MATTE_METAL).kind(kindCode(TINT.none, 0));
        blob(mb, p[0], y0 + h * 0.42, p[2], alongX ? ra : rw, h * rng.range(0.5, 0.6), alongX ? rw : ra, 7, 3);
      }
    }
  }
  return chunks.builders().map((b) => worldItem(b.toGeometry('uber')));
}
