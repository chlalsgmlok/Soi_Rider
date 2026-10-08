import type { Rng } from '../../core/rng';
import type { DistrictDef } from './district-types';
import type { RoadNet } from './net-types';
import { ON_VERGE, type PlaceCtx } from './place-ctx';
import { sidePoint, type SideFrame } from './side-frame';
import { pickW } from './weighted';

const NUDGES = [0, 1.2, -1.2, 2.4, -2.4, 3.6];

/** try a prop at s along the frame (nudging along the kerb when the spot is taken) */
function along(ctx: PlaceCtx, F: SideFrame, asset: string, s: number, d: number, heading: number, scale = 1, meta?: Record<string, string>): boolean {
  for (const k of NUDGES) {
    const t = s + k;
    if (t < F.v0 + 0.8 || t > F.v1 - 0.8) continue;
    if (ctx.prop(asset, sidePoint(F, t, d), heading, ON_VERGE, scale, meta)) return true;
  }
  return false;
}

/** canonical orientation of an edge's line (+x, or +z when vertical) so pole chains of one road share a key */
function canonical(F: SideFrame): { flip: boolean } {
  const { dir } = F.e;
  return { flip: dir.x < -1e-6 || (Math.abs(dir.x) <= 1e-6 && dir.z < 0) };
}

/**
 * Power poles every ~30 m on one side of every soi and avenue. meta.chain groups the poles of one road side,
 * meta.at orders them along it, so the visual builder can string the catenary wires pole to pole.
 */
function poles(net: RoadNet, ctx: PlaceCtx, F: SideFrame, rng: Rng, poleSide: Map<number, number>): void {
  const line = net.edgeLine[F.e.id];
  const { flip } = canonical(F);
  const want = poleSide.get(line) ?? (rng.chance(0.5) ? 1 : -1);
  poleSide.set(line, want);
  if ((flip ? -F.side : F.side) !== want) return;
  const d = F.hw + Math.min(0.45, F.verge - 0.25);
  const step = rng.range(27, 33);
  for (let s = F.v0 + rng.range(2, step * 0.6); s < F.v1 - 1; s += step) {
    const p = sidePoint(F, s, d);
    const at = flip ? -(p.x * F.e.dir.x + p.z * F.e.dir.z) : p.x * F.e.dir.x + p.z * F.e.dir.z;
    along(ctx, F, 'prop_power_pole', s, d, F.facing, 1, { chain: `${line}:${want}`, at: at.toFixed(1) });
  }
}

/**
 * Linear street furniture per road side: lamps along main roads (staggered both sides), street trees along wide
 * sidewalks (district recipe), power poles along sois / avenues, hydrants on main roads.
 */
export function placeStreetLines(net: RoadNet, ctx: PlaceCtx, def: DistrictDef, sides: readonly SideFrame[], rng: Rng): void {
  const R = def.recipe;
  const poleSide = new Map<number, number>();
  for (const F of sides) {
    const len = F.v1 - F.v0;
    if (len < 4) continue;
    if (F.e.cls === 'main' || (F.e.cls === 'avenue' && F.side > 0)) {
      const step = rng.range(30, 34);
      for (let s = F.v0 + (F.side > 0 ? 4 : 4 + step / 2); s < F.v1 - 2; s += step) along(ctx, F, 'prop_street_lamp', s, F.hw + 0.45, F.facing);
    }
    if (F.e.cls !== 'main') poles(net, ctx, F, rng, poleSide);
    if (F.e.cls !== 'soi' && F.verge >= 2.5) {
      const step = R.treeSpacing * rng.range(0.85, 1.15);
      for (let s = F.v0 + rng.range(5, step); s < F.v1 - 3; s += step * rng.range(0.85, 1.15)) {
        along(ctx, F, pickW(rng, R.streetTrees), s, F.hw + 1.3, rng.range(0, Math.PI * 2), rng.range(0.85, 1.15));
      }
    }
    if (F.e.cls === 'main' && rng.chance(len / 140)) along(ctx, F, 'prop_hydrant', F.v0 + rng.range(6, len - 6), F.hw + 0.4, F.facing);
  }
}
