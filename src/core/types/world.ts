import type { Bounds2, Circle, OBB, Vec2 } from './geometry';

/**
 * City / road network contract. Thailand drives on the LEFT:
 * every lane lies on the LEFT side of the road centreline relative to its own travel direction.
 * Lane.offset is the signed lateral offset of the lane centre from the edge centreline,
 * measured along left(dirAB) — so forward (a→b) lanes have offset > 0, backward lanes offset < 0.
 * Lane.index 0 = lane nearest the centreline/median (fast lane); highest index = curb lane.
 */
export type DistrictId = 'sukhumvit' | 'siam' | 'yaowarat' | 'khaosan' | 'silom';
export type RoadClass = 'main' | 'avenue' | 'soi';
export type TurnKind = 'straight' | 'left' | 'right' | 'uturn';

/** Surface raster codes (Uint8 in SurfaceMap). */
export const Surface = {
  Void: 0,
  Road: 1,
  Sidewalk: 2,
  Median: 3,
  Building: 4,
  Plaza: 5,
  Crosswalk: 6,
  Intersection: 7,
} as const;
export type SurfaceKind = (typeof Surface)[keyof typeof Surface];

export interface RoadNode {
  id: number;
  pos: Vec2;
  edges: number[];
  signal: boolean;
  /** half-size of the square intersection box; lanes are trimmed to stop at this distance from pos */
  radius: number;
}

export interface RoadEdge {
  id: number;
  a: number;
  b: number;
  cls: RoadClass;
  /** if true all lanes flow a→b */
  oneWay: boolean;
  lanesAB: number;
  lanesBA: number;
  laneWidth: number;
  /** median width (0 = painted centre line only) */
  median: number;
  /** sidewalk width on each side */
  sidewalk: number;
  /** BTS skytrain viaduct runs above this edge */
  skytrain: boolean;
  length: number;
  /** unit vector a→b */
  dir: Vec2;
  /** display name e.g. "Sukhumvit Rd", "Soi 23" */
  name: string;
  nameTh: string;
}

export interface Lane {
  id: number;
  edge: number;
  /** true = travels a→b */
  forward: boolean;
  index: number;
  start: Vec2;
  end: Vec2;
  dir: Vec2;
  length: number;
  width: number;
  offset: number;
  /** m/s */
  speedLimit: number;
  /** connector ids leaving this lane's end */
  out: number[];
  /** connector ids entering this lane's start */
  in: number[];
}

export interface Connector {
  id: number;
  from: number;
  to: number;
  node: number;
  turn: TurnKind;
  /** sampled path from from.end to to.start (≥ 2 points) */
  points: Vec2[];
  length: number;
}

export type PoiKind =
  | 'win_stand' | 'market' | 'mall' | 'temple' | 'bts' | 'hotel' | 'office'
  | 'condo' | 'food' | 'park' | 'hospital' | 'school' | 'shrine' | 'pier';

export interface POI {
  id: number;
  kind: PoiKind;
  name: string;
  nameTh: string;
  /** curbside stopping point (on the road, inside the curb lane) */
  pos: Vec2;
  /** lane the stop point lies in */
  lane: number;
  /** heading of that lane at the stop point */
  heading: number;
  /** landmark worth slowing down for (tourist trait) */
  landmark: boolean;
}

export type ColliderTag = 'building' | 'pole' | 'tree' | 'cart' | 'pillar' | 'barrier' | 'median' | 'furniture';

export interface StaticCollider {
  id: number;
  tag: ColliderTag;
  obb?: OBB;
  circle?: Circle;
}

export interface CityData {
  seed: number;
  district: DistrictId;
  bounds: Bounds2;
  nodes: RoadNode[];
  edges: RoadEdge[];
  lanes: Lane[];
  connectors: Connector[];
  pois: POI[];
  colliders: StaticCollider[];
  /** every building/prop instance — visuals (src/world/build) and colliders derive from this one list */
  placements: Placement[];
  /** building frontages along sidewalks (for shophouse rows), in placement order */
  frontages: Frontage[];
  /** where the run starts: the rider's win stand, on the road facing along the curb lane */
  spawn: { pos: Vec2; heading: number; poi: number };
}

/**
 * A model instance in the city. `asset` is a GLB name from docs/ASSET_SPEC.md. heading uses the sim convention
 * (model forward = +Z rotated by heading; buildings face the street along their forward axis).
 */
export interface Placement {
  asset: string;
  pos: Vec2;
  heading: number;
  /** uniform scale (1 = authored size) */
  scale: number;
  /** deterministic per-instance variant seed (colours, signage text, small offsets) */
  variant: number;
  /** collider generated for it, if any (StaticCollider.id) */
  collider: number | null;
  /** optional sign text keys / colour overrides chosen by the generator */
  meta?: Record<string, string>;
}

export interface Frontage {
  /** start/end along the building line (street side), facing `heading` toward the street */
  a: Vec2;
  b: Vec2;
  heading: number;
  edge: number;
  kind: 'shophouse' | 'commercial' | 'temple' | 'park' | 'tower';
}

export interface LaneHit {
  lane: Lane;
  /** distance along the lane from start (clamped 0..length) */
  s: number;
  /** signed lateral offset from lane centre, + = left of lane direction */
  lateral: number;
  dist: number;
}

/** Read-only query API implemented by src/world/city-query.ts */
export interface CityQuery {
  readonly data: CityData;
  surfaceAt(x: number, z: number): SurfaceKind;
  nearestLane(p: Vec2, maxDist?: number): LaneHit | null;
  lane(id: number): Lane;
  connector(id: number): Connector;
  edge(id: number): RoadEdge;
  node(id: number): RoadNode;
  /** static colliders whose bounds intersect the circle */
  staticNear(p: Vec2, r: number, out: StaticCollider[]): number;
  /** road display name at a point ("" if none) */
  roadNameAt(p: Vec2): string;
  /** true if a point is under the BTS viaduct or an awning (shade for the heat mechanic) */
  shadedAt(p: Vec2): boolean;
  /** roof height (m) of the building at a point, 0 off buildings — lets chase cameras see over low shophouses */
  roofAt?(x: number, z: number): number;
  /** underside (m) of an overhead structure you can ride under (BTS deck / station), 0 under open sky */
  ceilingAt?(x: number, z: number): number;
}
