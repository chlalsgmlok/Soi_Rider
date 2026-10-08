import type { Frontage, Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { DistrictDef } from './district-types';
import { soiCorner } from './frontages';
import type { RoadNet } from './net-types';
import { ON_VERGE, type PlaceCtx } from './place-ctx';
import { sidePoint, type SideFrame } from './side-frame';
import { pickW } from './weighted';

const BUS_ROUTES = ['2', '8', '25', '40', '48', '501', '508', '511', '2-38', '1-36'];
const CLUTTER = ['prop_bin', 'prop_crates', 'prop_ice_box', 'prop_cone', 'prop_barrier', 'prop_bin'] as const;
const STAND_MIN_VERGE = 2.4;

/** motorcycle-taxi stands (decorative, besides the spawn one) on major-road sidewalks beside soi mouths */
function winStands(net: RoadNet, ctx: PlaceCtx, def: DistrictDef, sides: readonly SideFrame[], rng: Rng): void {
  const spots: Array<[SideFrame, number, string]> = [];
  for (const F of sides) {
    if (F.verge < STAND_MIN_VERGE) continue;
    for (const [n, end] of [[F.e.a, 0], [F.e.b, 1]] as const) {
      if (F.e.cls === 'soi' || !soiCorner(net, F, n)) continue;
      const soi = net.nodes[n].edges.map((id) => net.edges[id]).find((g) => g.cls === 'soi');
      spots.push([F, end === 0 ? F.v0 + 2.2 : F.v1 - 2.2, soi?.nameTh ?? '']);
    }
  }
  let made = 0;
  for (const [F, s, soi] of rng.shuffle(spots)) {
    if (made >= def.recipe.winStands) break;
    const meta = { text: 'วิน', soi, number: String(rng.int(1, 60)) };
    if (ctx.prop('prop_win_stand', sidePoint(F, s, F.bl - 0.95), F.facing, ON_VERGE, 1, meta)) made++;
  }
}

/** BMTA bus shelters mid-block on main-road sidewalks */
function busStops(ctx: PlaceCtx, def: DistrictDef, sides: readonly SideFrame[], rng: Rng): void {
  const pool = rng.shuffle(sides.filter((f) => f.e.cls === 'main' && f.v1 - f.v0 > 60 && f.verge >= 3));
  let made = 0;
  for (const F of pool) {
    if (made >= def.recipe.busStops) break;
    const s = rng.range(F.v0 + 22, F.v1 - 22);
    if (ctx.prop('prop_bus_stop', sidePoint(F, s, F.bl - 1.05), F.facing, ON_VERGE, 1, { route: rng.pick(BUS_ROUTES) })) made++;
  }
}

/** point `k` metres in front of a frontage line at fraction t along it */
function inFront(f: Frontage, t: number, k: number): Vec2 {
  return {
    x: f.a.x + (f.b.x - f.a.x) * t + Math.sin(f.heading) * k,
    z: f.a.z + (f.b.z - f.a.z) * t + Math.cos(f.heading) * k,
  };
}

/** potted plants, spirit houses and shop clutter against the shophouse fronts (per 4 m unit) */
function shopFronts(ctx: PlaceCtx, def: DistrictDef, rng: Rng): void {
  const R = def.recipe;
  const clutterPerUnit = (R.clutterPer100m * 4) / 100;
  for (const f of ctx.frontages.slice()) {
    if (f.kind !== 'shophouse') continue;
    const units = Math.round(Math.hypot(f.b.x - f.a.x, f.b.z - f.a.z) / 4);
    for (let u = 0; u < units; u++) {
      const t = (u + rng.range(0.2, 0.8)) / units;
      if (rng.chance(R.plantsPerModule)) {
        const asset = pickW(rng, R.frontPlants);
        ctx.prop(asset, inFront(f, t, asset === 'prop_pot_plant' ? 0.4 : 0.5), rng.range(0, 6.28), ON_VERGE, rng.range(0.8, 1.05));
      } else if (rng.chance(R.spiritHouse)) {
        ctx.prop('prop_spirit_house', inFront(f, t, 0.55), f.heading, ON_VERGE);
      } else if (rng.chance(clutterPerUnit)) {
        const asset = rng.pick(CLUTTER);
        ctx.prop(asset, inFront(f, t, 0.45), f.heading + (asset === 'prop_barrier' ? Math.PI / 2 : 0), ON_VERGE);
      }
    }
  }
}

/** Street dressing after the stalls: win stands, bus stops, then shop-front plants / spirit houses / clutter. */
export function placeStreetDressing(net: RoadNet, ctx: PlaceCtx, def: DistrictDef, sides: readonly SideFrame[], rng: Rng): void {
  winStands(net, ctx, def, sides, rng);
  busStops(ctx, def, sides, rng);
  shopFronts(ctx, def, rng);
}
