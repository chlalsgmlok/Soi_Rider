import type { Rng } from '../../core/rng';
import { headingOf } from '../../core/math2d';
import { medianTrim } from './corner-geometry';
import type { RoadNet } from './net-types';
import { ON_MEDIAN, type PlaceCtx } from './place-ctx';

/** raised median kerb collider stays this far inside the median edge (lanes start exactly at the edge) */
const KERB_INSET = 0.06;

/**
 * Raised medians: one thin box collider per median run, and planted bougainvillea / palms along medians that
 * have no skytrain above (the BTS pillars bring their own planters).
 */
export function placeMedians(net: RoadNet, ctx: PlaceCtx, rng: Rng): void {
  const { nodes, edges, trims } = net;
  for (const e of edges) {
    if (e.median <= 0) continue;
    const s0 = medianTrim(nodes[e.a], trims[e.id * 2]);
    const s1 = e.length - medianTrim(nodes[e.b], trims[e.id * 2 + 1]);
    if (s1 - s0 < 1) continue;
    const a = nodes[e.a].pos;
    const mid = (s0 + s1) / 2;
    ctx.addCollider({
      tag: 'median',
      obb: { cx: a.x + e.dir.x * mid, cz: a.z + e.dir.z * mid, hw: e.median / 2 - KERB_INSET, hl: (s1 - s0) / 2, angle: headingOf(e.dir) },
    });
    if (e.skytrain) continue;
    const step = rng.range(9, 12);
    for (let s = s0 + 3 + rng.range(0, step / 2); s < s1 - 3; s += step) {
      const asset = rng.chance(0.7) ? 'prop_bougainvillea' : 'prop_palm';
      const pos = { x: a.x + e.dir.x * s, z: a.z + e.dir.z * s };
      ctx.prop(asset, pos, rng.range(0, Math.PI * 2), ON_MEDIAN, rng.range(0.85, 1.1));
    }
  }
}
