import { Box3, type Object3D } from 'three';
import { slab } from '../kit/frame-shapes';
import type { MeshBuilder } from '../kit/mesh-builder';
import { kindCode, TINT } from './material-rules';

const FRAME = { o: { x: 0, z: 0 }, d: { x: 0, z: 1 } };
/** plinth reaches this far below the floor so scaled / lot-ground buildings never float */
const DEPTH = 0.6;
const PLINTH_COLOR = '#8d857a';

/**
 * Buildings stand at sidewalk height (HEIGHTS.building); a concrete plinth under the footprint (behind the facade
 * line z ≤ 0) closes the gap down to the lot ground in alleys and back yards. Shophouse modules use their 4 m pitch.
 */
export function addPlinth(mb: MeshBuilder, asset: string, root: Object3D): void {
  const box = new Box3().setFromObject(root);
  const shop = asset.startsWith('bld_shophouse');
  const x0 = shop ? -2 : box.min.x + 0.05;
  const x1 = shop ? 2 : box.max.x - 0.05;
  const z0 = box.min.z + 0.05;
  const z1 = Math.min(0, box.max.z);
  if (z1 - z0 < 0.5 || x1 - x0 < 0.5) return;
  mb.color(PLINTH_COLOR).surf(0.92, 0).kind(kindCode(TINT.none, 0));
  // frame: s runs along +z (depth), l = left of +z = +x (width)
  slab(mb, FRAME, z0, z1, x0, x1, -DEPTH, -0.01);
}
