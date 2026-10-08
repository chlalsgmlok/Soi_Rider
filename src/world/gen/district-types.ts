import type { DistrictId, PoiKind, VehicleKind } from '../../core/types';
import type { PaletteKey } from '../../core/config/palette';

/** Display name of a road plus the prefix used to number the sois that branch off it. */
export interface RoadName {
  en: string;
  th: string;
  /** soi prefix, e.g. { en: 'Soi', th: 'ซอยสุขุมวิท' } → "Soi 23" / "ซอยสุขุมวิท 23" */
  soiEn: string;
  soiTh: string;
}

export type Weights<K extends string> = Partial<Record<K, number>>;

export type LotKind = 'park' | 'temple' | 'mall' | 'shrine';

/**
 * A landmark lot reserved during layout. `at`:
 * corner = touching the main×cross junction, main = along the skytrain main road,
 * cross = along the cross road, avenue = along the parallel avenue (falls back to any major road).
 */
export interface LotSpec {
  key: string;
  kind: LotKind;
  /** frontage width along the road, depth away from it (m) */
  w: number;
  d: number;
  at: 'corner' | 'main' | 'cross' | 'avenue';
  /** sign / display text for the builder (mall name, temple name) */
  sign?: string;
}

/** where a POI may be placed: on a road class, at a dead end (river piers), under the BTS station, or at a lot */
export type PoiWhere = 'main' | 'avenue' | 'soi' | 'deadEnd' | 'station' | 'any' | `lot:${string}`;

export interface PoiSpec {
  kind: PoiKind;
  /** Korean display name */
  name: string;
  /** Thai name */
  th: string;
  where: PoiWhere;
  landmark?: boolean;
}

export interface LayoutTuning {
  /** chance the cross road is a main road (else avenue) */
  crossMain: number;
  /** chance the cross road stops at the main road (T) instead of crossing it */
  crossT: number;
  /** chance of a parallel avenue */
  parallel: number;
  /** chance of a second cross avenue (only while avenues < 2) */
  cross2: number;
  /** soi mouth spacing along a road (m) */
  soiStep: readonly [number, number];
  /** chance a soi runs through to the next parallel road */
  through: number;
  /** chance two neighbouring sois are linked by a cross-soi */
  link: number;
  /** chance of a short dead-end branch (soi yaek) off a long soi */
  yaek: number;
  /** share of through-sois made one-way */
  oneWay: number;
  /** share of sois without a raised sidewalk */
  noSidewalk: number;
  /** longest dead-end soi (m) */
  deadEndMax: number;
  /** chance per long main-road block of a median U-turn opening */
  openings: number;
}

export type TreeAsset = 'prop_banana' | 'prop_bougainvillea' | 'prop_palm' | 'prop_raintree';
export type TowerAsset = 'bld_condo' | 'bld_office';
export type ShophouseAsset = 'bld_shophouse_2f' | 'bld_shophouse_3f' | 'bld_shophouse_4f';

/** Street-dressing recipe; densities are per opportunity (corner, module, metre …). */
export interface PropRecipe {
  /** street trees on main/avenue sidewalks */
  streetTrees: Weights<TreeAsset>;
  /** plants in front of shophouses / on aprons */
  frontPlants: Weights<TreeAsset | 'prop_pot_plant'>;
  /** trees inside back lots */
  infillTrees: Weights<TreeAsset>;
  /** chance of a food-cart cluster per soi-mouth corner */
  cartsPerCorner: number;
  /** extra carts per 100 m of wide sidewalk */
  cartsPer100m: number;
  /** Thai food words for cart signs */
  cartFoods: readonly string[];
  /** chance per shophouse module of a potted plant / small tree in front */
  plantsPerModule: number;
  /** chance per shophouse module of a spirit house */
  spiritHouse: number;
  /** decorative win stands at soi mouths (besides the spawn one) */
  winStands: number;
  busStops: number;
  /** chance a soi-mouth corner gets a mini-mart */
  minimart: number;
  /** chance per main/avenue frontage opportunity of a tower lot */
  tower: number;
  towerKinds: Weights<TowerAsset>;
  /** spacing of street trees along main roads (m) */
  treeSpacing: number;
  stoolColors: readonly PaletteKey[];
  umbrellaColors: readonly PaletteKey[];
  /** back-lot fill probabilities per sample */
  infillTree: number;
  infillBuilding: number;
  /** bins / barriers / crates per 100 m of sidewalk */
  clutterPer100m: number;
}

export interface DistrictDef {
  id: DistrictId;
  label: { ko: string; th: string; en: string };
  /** one-line Korean flavour text for menus */
  tagline: string;
  roads: {
    /** [0] = skytrain main road, [1] = cross main road */
    main: readonly RoadName[];
    avenue: readonly RoadName[];
    /** named sois that replace numbered ones */
    special: ReadonlyArray<{ en: string; th: string }>;
    /** the rider's home soi; `number` anchors the numbering of its side */
    spawn: { en: string; th: string; number: number };
  };
  spawnPoi: { name: string; th: string };
  station: PoiSpec;
  layout: LayoutTuning;
  floors: Weights<ShophouseAsset>;
  palette: { wall: Weights<PaletteKey>; awning: Weights<PaletteKey>; sign: Weights<PaletteKey> };
  signs: {
    th: readonly string[];
    en: readonly string[];
    /** visual style hint for the builder: shop | vertical (Chinatown) | backpacker | mall | office */
    style: 'shop' | 'vertical' | 'backpacker' | 'mall' | 'office';
  };
  recipe: PropRecipe;
  lots: readonly LotSpec[];
  /** POI pool (14–24 are used per run); landmark lots and the station are always included */
  pois: readonly PoiSpec[];
  /** relative NPC vehicle mix hint for src/traffic */
  traffic: Weights<VehicleKind>;
  ambience: { lanterns: boolean; skywalk: boolean; neon: number; haze: number };
}
