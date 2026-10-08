import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Placement } from '../../../core/types';
import type { CityHeights } from '../heights';

const UP = new Vector3(0, 1, 0);
const q = new Quaternion();
const t = new Vector3();
const s = new Vector3();

/** world matrix of a model at (x, y, z) facing heading (sim convention: rotation.y = heading) with uniform scale */
export function poseMatrix(x: number, y: number, z: number, heading: number, scale = 1, out = new Matrix4()): Matrix4 {
  q.setFromAxisAngle(UP, heading);
  return out.compose(t.set(x, y, z), q, s.set(scale, scale, scale));
}

/** world matrices of every placement (index-aligned with data.placements) */
export function placementMatrices(placements: readonly Placement[], heights: CityHeights): Matrix4[] {
  return placements.map((p) => poseMatrix(p.pos.x, heights.placementY(p), p.pos.z, p.heading, p.scale));
}
