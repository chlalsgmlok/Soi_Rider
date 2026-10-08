import type { OBB } from '../../core/types';
import type { SurfaceMap } from '../surface-map';

/** forward unit vector of an OBB (sim heading convention: forward = (sin θ, cos θ)) */
export const obbForward = (o: OBB): { x: number; z: number } => ({ x: Math.sin(o.angle), z: Math.cos(o.angle) });

/** paint an OBB (grown by `pad` metres on every side) into the raster, only over codes in `over` */
export function paintObb(map: SurfaceMap, o: OBB, code: number, over = -1, pad = 0): void {
  map.fillObb(o.cx, o.cz, o.angle, o.hw + pad, o.hl + pad, code, over);
}

/** every raster cell under the OBB (grown by `pad`, which may be negative) has a code in `allowed` */
export function obbAll(map: SurfaceMap, o: OBB, allowed: number, pad = 0): boolean {
  return map.obbAllWith(null, o.cx, o.cz, o.angle, o.hw + pad, o.hl + pad, allowed, 0);
}

/** obbAll over two rasters of identical geometry (e.g. surface + keep-out) in one pass */
export function obbAllWith(map: SurfaceMap, other: SurfaceMap, o: OBB, allowed: number, otherAllowed: number): boolean {
  return map.obbAllWith(other, o.cx, o.cz, o.angle, o.hw, o.hl, allowed, otherAllowed);
}
