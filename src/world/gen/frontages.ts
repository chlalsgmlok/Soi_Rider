import type { Rng } from '../../core/rng';
import type { DistrictDef } from './district-types';
import type { RoadNet } from './net-types';
import type { PlaceCtx } from './place-ctx';
import { dirFrom } from './road-geometry';
import { buildRows, SHOP_DEPTH, type RowStyle } from './rows';
import { sideBox, sidePoint, type SideFrame } from './side-frame';
import { martMeta, rowLook, shopMeta } from './signage';
import { pickW } from './weighted';

export { MODULE, SHOP_DEPTH } from './rows';

const MART_W = 8;
const MART_D = 12;
/** back rows behind each street row (sub-soi row houses), the alley between rows, and the rows' gap rate */
const BACK_ROWS = 3;
const ALLEY: readonly [number, number] = [2.5, 4.5];

/** does a soi branch off node n on this side of the frame (a soi-mouth corner)? */
export function soiCorner(net: RoadNet, F: SideFrame, n: number): boolean {
  const d = dirFrom(F.e, n);
  const sideD = F.e.a === n ? F.side : -F.side;
  return net.nodes[n].edges.some((id) => {
    if (id === F.e.id || net.edges[id].cls !== 'soi') return false;
    const g = dirFrom(net.edges[id], n);
    return (d.z * g.x - d.x * g.z) * sideD > 0.2;
  });
}

function mart(ctx: PlaceCtx, F: SideFrame, s: number, rng: Rng): boolean {
  const box = sideBox(F, s, s + MART_W, F.bl, F.bl + MART_D);
  if (!ctx.buildingFits(box)) return false;
  ctx.claimBuilding(box);
  const collider = ctx.addCollider({ tag: 'building', obb: box });
  ctx.add('bld_minimart', sidePoint(F, s + MART_W / 2, F.bl), F.facing, { collider, meta: martMeta(rng) });
  ctx.frontages.push({ a: sidePoint(F, s, F.bl), b: sidePoint(F, s + MART_W, F.bl), heading: F.facing, edge: F.e.id, kind: 'commercial' });
  return true;
}

/** street rows: runs of 3–8 identical shophouses (district floor mix), shop signs and awnings, rare alleys */
function streetStyle(def: DistrictDef, rng: Rng): RowStyle {
  return {
    gap: 0.035,
    frontage: true,
    probe: 2,
    run: () => {
      const look = rowLook(rng, def);
      return { asset: pickW(rng, def.floors), length: rng.int(3, 8), meta: () => shopMeta(rng, def, look) };
    },
  };
}

/** back rows: lower, shuttered row houses with more gaps (yards, trees) */
function backStyle(def: DistrictDef, rng: Rng): RowStyle {
  return {
    gap: 0.12,
    frontage: false,
    probe: 4,
    run: () => {
      const look = rowLook(rng, def);
      const asset = rng.chance(0.55) ? 'bld_shophouse_2f' : pickW(rng, def.floors);
      const meta = { wall: look.wall, awning: look.awning, shutter: 'closed', infill: '1', style: def.signs.style };
      return { asset, length: rng.int(2, 6), meta: () => ({ ...meta }) };
    },
  };
}

/**
 * Street frontages: along every road side (majors first) a corner minimart where a soi meets a main road or
 * avenue, then rows of 2–4 storey shophouses in 4 m modules wherever the 10 m deep footprint is free.
 */
export function placeFrontages(net: RoadNet, ctx: PlaceCtx, def: DistrictDef, sides: readonly SideFrame[], rng: Rng): void {
  const style = streetStyle(def, rng);
  for (const F of sides) {
    let s0 = F.f0;
    let s1 = F.f1;
    if (s1 - s0 < 4) continue;
    if (F.e.cls !== 'soi') {
      if (soiCorner(net, F, F.e.a) && rng.chance(def.recipe.minimart) && mart(ctx, F, s0, rng)) s0 += MART_W;
      if (soiCorner(net, F, F.e.b) && rng.chance(def.recipe.minimart) && mart(ctx, F, s1 - MART_W, rng)) s1 -= MART_W;
    }
    buildRows(ctx, F, s0, s1, F.bl, style, rng);
  }
}

/**
 * Dense back-lot fabric: up to three further rows of row houses behind each street row, separated by narrow
 * alleys, aligned with the street (a row stops where it meets another street's rows, a lot or a road).
 */
export function placeBackRows(ctx: PlaceCtx, def: DistrictDef, sides: readonly SideFrame[], rng: Rng): void {
  const style = backStyle(def, rng);
  for (let k = 1; k <= BACK_ROWS; k++) {
    for (const F of sides) {
      if (F.f1 - F.f0 < 12) continue;
      const d0 = F.bl + k * SHOP_DEPTH + k * rng.range(ALLEY[0], ALLEY[1]);
      const inset = k * 3;
      buildRows(ctx, F, F.f0 + inset, F.f1 - inset, d0, style, rng);
    }
  }
}
