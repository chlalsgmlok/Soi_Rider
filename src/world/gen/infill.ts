import type { Bounds2, OBB } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { DistrictDef } from './district-types';
import { MODULE, SHOP_DEPTH } from './frontages';
import { ON_GROUND, type PlaceCtx } from './place-ctx';
import { rowLook } from './signage';
import { pickW } from './weighted';

const STEP = 10;
const AXES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/** row of `n` back-lot houses centred at (x, z) facing `h`; returns false when it does not fit */
function houses(ctx: PlaceCtx, def: DistrictDef, x: number, z: number, h: number, n: number, rng: Rng): boolean {
  const f = { x: Math.sin(h), z: Math.cos(h) };
  const r = { x: -Math.cos(h), z: Math.sin(h) };
  const box: OBB = { cx: x, cz: z, hw: (n * MODULE) / 2, hl: SHOP_DEPTH / 2, angle: h };
  if (!ctx.buildingFits({ ...box, hw: box.hw + 1.2, hl: box.hl + 1.2 }, ON_GROUND)) return false;
  ctx.claimBuilding(box);
  const collider = ctx.addCollider({ tag: 'building', obb: box });
  const look = rowLook(rng, def);
  const asset = rng.chance(0.6) ? 'bld_shophouse_2f' : pickW(rng, def.floors);
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) * MODULE - box.hw;
    const pos = { x: x + f.x * (SHOP_DEPTH / 2) + r.x * u, z: z + f.z * (SHOP_DEPTH / 2) + r.z * u };
    ctx.add(asset, pos, h, { collider, meta: { wall: look.wall, awning: look.awning, shutter: 'closed', infill: '1', style: def.signs.style } });
  }
  return true;
}

/**
 * Fill what is left of superblock interiors after the street and back rows: odd back-lot houses and yard trees
 * (banana, rain trees, palms) by the district recipe's infill probabilities.
 */
export function placeInfill(ctx: PlaceCtx, def: DistrictDef, bounds: Bounds2, rng: Rng): void {
  const R = def.recipe;
  for (let z = bounds.minZ + 8; z < bounds.maxZ - 8; z += STEP) {
    for (let x = bounds.minX + 8; x < bounds.maxX - 8; x += STEP) {
      const px = x + rng.range(-3, 3);
      const pz = z + rng.range(-3, 3);
      if (ctx.surface.at(px, pz) !== 0 || ctx.occ.at(px, pz) !== 0) continue;
      if (rng.chance(R.infillBuilding * 0.5) && houses(ctx, def, px, pz, rng.pick(AXES), rng.int(2, 4), rng)) continue;
      if (rng.chance(R.infillTree)) ctx.prop(pickW(rng, R.infillTrees), { x: px, z: pz }, rng.range(0, 6.28), ON_GROUND, rng.range(0.85, 1.25));
    }
  }
}
