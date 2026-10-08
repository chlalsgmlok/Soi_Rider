import type { CityData } from '../../core/types';
import { Surface } from '../../core/types';
import { SurfaceMap, surfaceMask } from '../surface-map';
import { plazasFromMeta } from './lot-frame';
import { paintObb } from './obb-paint';
import { edgeTrims } from './road-geometry';
import { cachedSurface, rememberSurface } from './surface-cache';
import { paintNetwork } from './surface-paint';

/** which surface codes a lot plaza / a building footprint may be painted over */
export const LOT_OVER = surfaceMask(Surface.Void);
export const BUILDING_OVER = surfaceMask(Surface.Void, Surface.Plaza);

/**
 * The SurfaceMap of a city, rebuilt purely from CityData (network from nodes/edges/lanes, plazas from lot anchor
 * meta, buildings from building colliders) — identical to the raster generateCity() produced, which is reused
 * when this CityData object came straight from the generator.
 */
export function buildSurfaceMap(data: CityData): SurfaceMap {
  const cached = cachedSurface(data);
  if (cached) return cached;
  const map = new SurfaceMap(data.bounds);
  paintNetwork(map, data.nodes, data.edges, edgeTrims(data.edges, data.lanes, data.nodes), data.bounds);
  for (const p of data.placements) for (const o of plazasFromMeta(p.meta)) paintObb(map, o, Surface.Plaza, LOT_OVER);
  for (const c of data.colliders) if (c.tag === 'building' && c.obb) paintObb(map, c.obb, Surface.Building, BUILDING_OVER);
  rememberSurface(data, map);
  return map;
}
