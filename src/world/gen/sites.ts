import type { RoadClass } from '../../core/types';
import type { Rng } from '../../core/rng';
import type { DistrictDef, PoiSpec, TowerAsset } from './district-types';
import { lotArea, lotFromSide, type LotFrame } from './lot-frame';
import { LotKit } from './lot-kit';
import { buildPark, buildShrine, buildTemple, buildMall, type LotInfo } from './lot-landmarks';
import { buildMarket, buildTower, towerLot } from './lot-sites-build';
import type { PlacedLot } from './lots';
import { ON_GROUND, type PlaceCtx } from './place-ctx';
import type { SideFrame } from './side-frame';
import { pickW } from './weighted';

/** Choose the run's POIs: every placed landmark lot + the BTS station, then a shuffled share of the pool (14–23). */
export function selectPois(def: DistrictDef, rng: Rng, lots: readonly PlacedLot[], hasStation: boolean, hasDeadEnd: boolean): PoiSpec[] {
  const placed = new Set(lots.map((l) => l.key));
  const must = def.pois.filter((p) => p.where.startsWith('lot:') && placed.has(p.where.slice(4)));
  if (hasStation) must.push(def.station);
  const pool = rng.shuffle(def.pois.filter((p) => !p.where.startsWith('lot:') && p.where !== 'station' && (hasDeadEnd || p.where !== 'deadEnd')));
  const total = rng.int(14, 23);
  return [...must, ...pool.slice(0, Math.max(0, total - must.length))];
}

/** a roadside lot of width × depth on a side of class `cls`, entirely on bare ground (null after `tries`) */
export function findSite(ctx: PlaceCtx, sides: readonly SideFrame[], cls: RoadClass | 'any', W: number, D: number, rng: Rng, tries = 50): LotFrame | null {
  const pool = sides.filter((f) => (cls === 'any' || f.e.cls === cls) && f.f1 - f.f0 > W + 2);
  if (pool.length === 0) return null;
  for (let k = 0; k < tries; k++) {
    const F = rng.weighted(pool, (f) => f.f1 - f.f0 - W);
    const s0 = rng.range(F.f0 + 1, F.f1 - W - 1);
    const lot = lotFromSide(F, s0, s0 + W, F.bl + 0.6, F.bl + 0.6 + D);
    if (ctx.buildingFits(lotArea(lot), ON_GROUND)) return lot;
  }
  return null;
}

interface SitePlan {
  size: [number, number];
  build: (K: LotKit, info: LotInfo) => boolean;
}

function towerPlan(asset: TowerAsset, scale: number, kind: string): SitePlan {
  return { size: towerLot(asset, scale), build: (K, info) => buildTower(K, asset, scale, kind, info) };
}

/** what a POI needs built in front of it (null = it lives on an ordinary shophouse frontage / cart / road) */
function sitePlan(spec: PoiSpec, rng: Rng): SitePlan | null {
  switch (spec.kind) {
    case 'office': return towerPlan('bld_office', rng.range(0.7, 0.9), 'office');
    case 'condo': return towerPlan('bld_condo', rng.range(0.7, 0.95), 'condo');
    case 'hotel': return towerPlan('bld_condo', rng.range(0.6, 0.8), 'hotel');
    case 'hospital': return towerPlan('bld_condo', rng.range(0.75, 0.9), 'hospital');
    case 'mall': return { size: [36, 34], build: buildMall };
    case 'market': return { size: [rng.range(24, 30), rng.range(18, 22)], build: buildMarket };
    case 'temple': return { size: [30, 36], build: buildTemple };
    case 'shrine': return { size: [12, 12], build: buildShrine };
    case 'park': return { size: [40, 36], build: buildPark };
    default: return null;
  }
}

const classOf = (spec: PoiSpec): RoadClass | 'any' =>
  spec.where === 'main' || spec.where === 'avenue' || spec.where === 'soi' ? spec.where : 'any';

/** build a lot for every POI that needs one; returns POI → lot (POIs without a lot are absent) */
export function placePoiSites(ctx: PlaceCtx, sides: readonly SideFrame[], specs: readonly PoiSpec[], rng: Rng): Map<PoiSpec, LotFrame> {
  const out = new Map<PoiSpec, LotFrame>();
  for (const spec of specs) {
    if (spec.where.startsWith('lot:') || spec.where === 'station' || spec.where === 'deadEnd') continue;
    const plan = sitePlan(spec, rng);
    if (!plan) continue;
    const [W, D] = plan.size;
    const lot = findSite(ctx, sides, classOf(spec), W, D, rng) ?? findSite(ctx, sides, 'any', W, D, rng);
    if (lot && plan.build(new LotKit(ctx, lot), { poi: spec.name, poiTh: spec.th, sign: spec.th })) out.set(spec, lot);
  }
  return out;
}

/** extra condo / office towers along main roads and avenues for the district skyline inside the map */
export function placeRecipeTowers(ctx: PlaceCtx, def: DistrictDef, sides: readonly SideFrame[], rng: Rng): number {
  const want = Math.max(0, Math.round(def.recipe.tower * 14 + rng.range(-1, 1)));
  let made = 0;
  for (let k = 0; k < want; k++) {
    const asset = pickW(rng, def.recipe.towerKinds);
    const scale = rng.range(0.7, 1.0);
    const [W, D] = towerLot(asset, scale);
    const lot = findSite(ctx, sides, rng.chance(0.6) ? 'main' : 'avenue', W, D, rng, 25);
    if (lot && buildTower(new LotKit(ctx, lot), asset, scale, asset === 'bld_office' ? 'office' : 'condo', {})) made++;
  }
  return made;
}
