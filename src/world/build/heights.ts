import type { CityData, OBB, Placement } from '../../core/types';
import { Surface } from '../../core/types';
import { obbFromMeta, plazasFromMeta } from '../gen/lot-frame';
import type { SurfaceMap } from '../surface-map';
import { HEIGHTS } from './kit/dims';
import { insideObb, obbLocal } from './kit/obb-inside';
import type { SpeedBump } from './types';

/** lawns of park lots (anchor meta.lot === 'park' carries the whole lot area) */
export function parkAreas(data: CityData): OBB[] {
  const out: OBB[] = [];
  for (const p of data.placements) {
    if (p.meta?.lot !== 'park' || !p.meta.area) continue;
    const o = obbFromMeta(p.meta.area);
    if (o) out.push(o);
  }
  return out;
}

/** every paved lot court (temples, malls, towers, markets, park paths) */
export function lotPlazas(data: CityData): OBB[] {
  return data.placements.flatMap((p) => plazasFromMeta(p.meta));
}

/**
 * Visual ground heights of the city view, consistent with the geometry it builds: road 0, sidewalks / lot courts /
 * building floors raised, flush aprons, raised medians, park lawns, sunken back lots and speed humps.
 */
export class CityHeights {
  private readonly plazas: OBB[];
  private readonly lawns: OBB[];
  private bumps: readonly SpeedBump[] = [];

  constructor(data: CityData, private readonly surface: SurfaceMap) {
    this.plazas = lotPlazas(data);
    this.lawns = parkAreas(data);
  }

  setBumps(bumps: readonly SpeedBump[]): void {
    this.bumps = bumps;
  }

  ground(x: number, z: number): number {
    switch (this.surface.at(x, z)) {
      case Surface.Sidewalk:
      case Surface.Building:
        return HEIGHTS.sidewalk;
      case Surface.Plaza:
        return this.plazas.some((o) => insideObb(o, x, z)) ? HEIGHTS.plaza : HEIGHTS.apron;
      case Surface.Median:
        return HEIGHTS.median;
      case Surface.Void:
        return this.lawns.some((o) => insideObb(o, x, z)) ? HEIGHTS.lawn : HEIGHTS.lot;
      default:
        return HEIGHTS.road + this.bumpAt(x, z);
    }
  }

  /** y of a placement's origin: buildings on their plinth floor, BTS from the road, props on whatever is under them */
  placementY(p: Placement): number {
    if (p.asset.startsWith('bld_')) return HEIGHTS.building;
    if (p.asset.startsWith('bts_')) return HEIGHTS.road;
    return this.ground(p.pos.x, p.pos.z);
  }

  private bumpAt(x: number, z: number): number {
    for (const b of this.bumps) {
      const [r, f] = obbLocal(b.obb, x, z);
      if (Math.abs(r) > b.obb.hw || Math.abs(f) > b.obb.hl) continue;
      return b.height * 0.5 * (1 + Math.cos((Math.PI * f) / b.obb.hl));
    }
    return 0;
  }
}
