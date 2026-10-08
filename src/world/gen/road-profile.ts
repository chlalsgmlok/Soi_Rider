import type { RoadClass, RoadEdge } from '../../core/types';

/** Default cross-section per road class (metres, km/h). Sois vary lane width per line (3.0–3.4 m). */
export interface RoadProfile {
  /** lanes per direction */
  lanes: number;
  laneWidth: number;
  /** raised median (0 = painted centre line) */
  median: number;
  sidewalk: number;
  speedKmh: number;
}

export const ROAD_PROFILE: Readonly<Record<RoadClass, RoadProfile>> = {
  main: { lanes: 3, laneWidth: 3.2, median: 2.4, sidewalk: 3.5, speedKmh: 50 },
  avenue: { lanes: 2, laneWidth: 3.1, median: 0, sidewalk: 3.0, speedKmh: 40 },
  soi: { lanes: 1, laneWidth: 3.1, median: 0, sidewalk: 1.5, speedKmh: 25 },
};

/** flush paved apron in front of buildings on sois without a raised sidewalk (Surface.Plaza) */
export const SOI_APRON = 0.7;
/** the rider's home soi gets a wider sidewalk so the win stand fits */
export const SPAWN_SOI_SIDEWALK = 2.5;
/** turnaround bulb radius beyond the carriageway half width at dead ends */
export const BULB_EXTRA = 2.2;

/** carriageway half width of a class with default lanes (used before edges exist) */
export function classHalfWidth(cls: RoadClass): number {
  const p = ROAD_PROFILE[cls];
  return p.median / 2 + p.lanes * p.laneWidth;
}

/** distance from the centreline to the building line for a class with default sidewalks */
export function classBuildingLine(cls: RoadClass): number {
  return classHalfWidth(cls) + ROAD_PROFILE[cls].sidewalk;
}

/**
 * Carriageway half width of an edge. The carriageway is always symmetric about the centreline; a one-way soi
 * keeps its single lane on the LEFT half and the right half is a flush parking/stall strip.
 */
export function halfWidth(e: RoadEdge): number {
  return e.median / 2 + Math.max(e.lanesAB, e.lanesBA) * e.laneWidth;
}

/** paved width beside the carriageway on each side: sidewalk, or the flush apron on sidewalk-less sois */
export function verge(e: RoadEdge): number {
  return e.sidewalk > 0 ? e.sidewalk : SOI_APRON;
}

/** distance from the centreline to the building line (facades stand here) */
export function buildingLine(e: RoadEdge): number {
  return halfWidth(e) + verge(e);
}

/** radius of the road-surface turnaround circle at a dead end of this edge */
export function bulbRadius(e: RoadEdge): number {
  return halfWidth(e) + BULB_EXTRA;
}
