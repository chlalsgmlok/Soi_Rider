import type { Bounds2, DistrictId } from '../../core/types';
import { HALF } from './layout-builder';

/** playable square (m); the skyline ring of background towers stands outside it */
export const CITY_BOUNDS: Readonly<Bounds2> = { minX: -HALF, minZ: -HALF, maxX: HALF, maxZ: HALF };

/** stable 32-bit seed mix of the run seed and the district so each district has its own city per seed */
export function citySeed(seed: number, district: DistrictId): number {
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (let i = 0; i < district.length; i++) h = Math.imul(h ^ district.charCodeAt(i), 0x01000193);
  h ^= h >>> 15;
  return Math.imul(h, 0x2c1b3c6d) >>> 0;
}
