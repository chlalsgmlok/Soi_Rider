import type { CityData } from '../../core/types';
import type { SurfaceMap } from '../surface-map';

/** generateCity() leaves its raster here so createCityQuery() does not have to rebuild it */
const cache = new WeakMap<CityData, SurfaceMap>();

export function rememberSurface(data: CityData, map: SurfaceMap): void {
  cache.set(data, map);
}

export function cachedSurface(data: CityData): SurfaceMap | undefined {
  return cache.get(data);
}
