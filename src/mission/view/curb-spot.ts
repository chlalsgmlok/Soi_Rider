import { Surface, type CityQuery, type POI, type Vec2 } from '../../core/types';

/** where a person / prop stands beside a POI stop point */
export interface CurbSpot {
  pos: Vec2;
  /** yaw that faces the carriageway */
  face: number;
}

const SCAN = 8;
const STEP = 0.25;

/** metres from p toward unit (dx, dz) to the first walkable off-road surface, or Infinity (a wall comes first) */
function reach(city: CityQuery, p: Vec2, dx: number, dz: number): number {
  for (let d = 0.5; d <= SCAN; d += STEP) {
    const k = city.surfaceAt(p.x + dx * d, p.z + dz * d);
    if (k === Surface.Sidewalk || k === Surface.Plaza) return d;
    if (k === Surface.Building) return Infinity;
  }
  return Infinity;
}

/**
 * A spot on the sidewalk next to a POI's curbside stop point, `inset` metres past the curb. The curb is usually on
 * the lane's left (Thailand drives on the left) but one-way streets can put the stop on the right, so both sides are
 * scanned and the nearer kerb wins; sois without a raised sidewalk fall back to a fixed offset on the left.
 */
export function curbSpot(city: CityQuery, poi: POI, inset = 0.9): CurbSpot {
  const lx = Math.cos(poi.heading);
  const lz = -Math.sin(poi.heading);
  const left = reach(city, poi.pos, lx, lz);
  const right = reach(city, poi.pos, -lx, -lz);
  const useLeft = left <= right || !Number.isFinite(right);
  const side = useLeft ? 1 : -1;
  const d = (useLeft ? left : right) + inset;
  const dist = Number.isFinite(d) ? d : 2.6;
  return {
    pos: { x: poi.pos.x + lx * side * dist, z: poi.pos.z + lz * side * dist },
    // face the road: right of the lane for a left-side kerb, left of it otherwise
    face: poi.heading - (side * Math.PI) / 2,
  };
}
