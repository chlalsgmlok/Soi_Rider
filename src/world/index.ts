/**
 * World module public API (pure data side). The scene builder (src/world/build) re-exports from here later:
 *   export * from './build';
 */
export { generateCity } from './gen/generate';
export { createCityQuery, NEAREST_LANE_DEFAULT } from './city-query';
export { DISTRICTS, DISTRICT_IDS } from './districts';
export type { DistrictDef, LotKind, LotSpec, PoiSpec, PoiWhere, PropRecipe, RoadName, LayoutTuning } from './districts';
export { RoofMap, ROOF_SIZES, DEFAULT_ROOF } from './roof-map';
export { SurfaceMap, SURFACE_CELL, surfaceMask, DRIVABLE } from './surface-map';
export { buildSurfaceMap } from './gen/surface-build';
export { plazasFromMeta, obbFromMeta } from './gen/lot-frame';
export { buildShadeMap, AWNING_DEPTH, DECK_HALF } from './gen/shade-map';
export { CITY_BOUNDS } from './gen/city-bounds';
export {
  ROAD_PROFILE, SOI_APRON, BULB_EXTRA, halfWidth, verge, buildingLine, bulbRadius, classHalfWidth,
} from './gen/road-profile';
export type { RoadProfile } from './gen/road-profile';
export {
  dirFrom, otherEnd, leftOfDir, edgePoint, onBounds, nodeKind, exitNodes, edgeTrims, approachGroups,
} from './gen/road-geometry';
export type { NodeKind } from './gen/road-geometry';
export { vergeTrim, frontageTrim, medianTrim } from './gen/corner-geometry';
export { CROSSWALK_FROM, CROSSWALK_TO } from './gen/surface-paint';
export { SIGNAL_PAD, CORNER_PAD, DEAD_END_TRIM, OPENING_TRIM } from './gen/junctions';
export { movement, turnKind } from './gen/movement';
export { buildStateGraph, reachable, stronglyConnected } from './gen/state-graph';
export type { StateGraph } from './gen/state-graph';
export * from './build';
