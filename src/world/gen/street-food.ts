import type { Placement } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { DistrictDef } from './district-types';
import { soiCorner } from './frontages';
import type { RoadNet } from './net-types';
import { ON_VERGE, type PlaceCtx } from './place-ctx';
import { sidePoint, type SideFrame } from './side-frame';
import { hexOf } from './weighted';

/** a street-food stall needs at least this much sidewalk / apron */
export const CART_MIN_VERGE = 1.5;

/**
 * Street-food stall at s along a road side: push cart against the shop fronts with its glass case facing the
 * street, an umbrella beside it and (on sidewalks ≥ 2.5 m) folding tables ringed with plastic stools.
 * Returns the cart placement or null when it does not fit.
 */
export function foodStall(ctx: PlaceCtx, def: DistrictDef, F: SideFrame, s: number, rng: Rng, text?: string): Placement | null {
  if (F.verge < CART_MIN_VERGE || s < F.v0 + 1.5 || s > F.v1 - 1.5) return null;
  const R = def.recipe;
  const umbrella = hexOf(rng.pick(R.umbrellaColors));
  const cart = ctx.prop('prop_food_cart', sidePoint(F, s, F.bl - 0.8), F.facing, ON_VERGE, 1, {
    text: text ?? rng.pick(R.cartFoods), paint: umbrella,
  });
  if (!cart) return null;
  const dir = rng.chance(0.5) ? 1 : -1;
  ctx.prop('prop_umbrella', sidePoint(F, s + dir * 1.55, F.bl - 0.75), F.facing, ON_VERGE, 1, { color: umbrella });
  if (F.verge >= 2.5) {
    const tables = F.verge >= 3 ? 2 : 1;
    for (let k = 0; k < tables; k++) {
      const ts = s - dir * (2.5 + k * 2.3);
      const td = F.hw + F.verge * 0.5;
      if (!ctx.prop('prop_table', sidePoint(F, ts, td), F.facing, ON_VERGE)) continue;
      for (const [ds, dd] of [[0.82, 0], [-0.82, 0], [0, 0.78], [0, -0.78]] as const) {
        if (!rng.chance(0.75)) continue;
        ctx.prop('prop_stool', sidePoint(F, ts + ds, td + dd), rng.range(0, 6.28), ON_VERGE, 1, { color: hexOf(rng.pick(R.stoolColors)) });
      }
    }
  }
  if (rng.chance(0.45)) ctx.prop(rng.chance(0.5) ? 'prop_ice_box' : 'prop_crates', sidePoint(F, s + dir * 2.9, F.bl - 0.5), F.facing, ON_VERGE);
  return cart;
}

/**
 * Food stalls by district recipe: clustered at soi-mouth corners of main roads / avenues (the classic Bangkok
 * corner), at soi mouths with a sidewalk, and scattered mid-block on wide sidewalks.
 */
export function placeStreetFood(net: RoadNet, ctx: PlaceCtx, def: DistrictDef, sides: readonly SideFrame[], rng: Rng): void {
  const R = def.recipe;
  for (const F of sides) {
    if (F.verge < CART_MIN_VERGE) continue;
    const major = F.e.cls !== 'soi';
    for (const [n, end] of [[F.e.a, 0], [F.e.b, 1]] as const) {
      const corner = major ? soiCorner(net, F, n) : net.nodes[n].edges.some((id) => net.edges[id].cls !== 'soi');
      if (!corner || !rng.chance(major ? R.cartsPerCorner : R.cartsPerCorner * 0.5)) continue;
      const off = rng.range(2.5, 6);
      foodStall(ctx, def, F, end === 0 ? F.v0 + off : F.v1 - off, rng);
    }
    if (!major) continue;
    const len = F.v1 - F.v0;
    const extra = Math.floor((len / 100) * R.cartsPer100m + rng.next());
    for (let k = 0; k < extra; k++) foodStall(ctx, def, F, F.v0 + rng.range(8, Math.max(9, len - 8)), rng);
  }
}
