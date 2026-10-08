import { type Object3D, Quaternion, Vector3 } from 'three';

const t = new Vector3();
const pole = new Vector3();
const dir = new Vector3();
const elbow = new Vector3();
const seg = new Vector3();
const rest = new Vector3();
const q = new Quaternion();
const qInv = new Quaternion();

/**
 * Two-bone IK for the segmented (unskinned) character rig: rotates `upper` (in its parent's space) and `lower`
 * (in upper's space) so that `end`'s origin lands on `targetWorld`, bending the middle joint toward `poleWorld`
 * (a world-space direction). Bone lengths/rest directions come from the children's rest offsets. If the target is
 * out of reach the limb straightens toward it. `upper.parent` must have an up-to-date matrixWorld.
 * Returns the reach ratio (distance / total length) for callers that want to fade a pose when over-stretched.
 */
export function solveTwoBone(upper: Object3D, lower: Object3D, end: Object3D, targetWorld: Vector3, poleWorld: Vector3): number {
  const parent = upper.parent;
  if (!parent) return 0;
  // target + pole into the parent's space
  t.copy(targetWorld);
  parent.worldToLocal(t);
  parent.getWorldQuaternion(qInv).invert();
  pole.copy(poleWorld).applyQuaternion(qInv);

  const l1 = lower.position.length();
  const l2 = end.position.length();
  dir.subVectors(t, upper.position);
  const raw = dir.length();
  const d = Math.min(Math.max(raw, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  if (raw < 1e-6) return 0;
  dir.divideScalar(raw);

  // bend direction: pole component perpendicular to the shoulder→target line
  pole.addScaledVector(dir, -pole.dot(dir));
  if (pole.lengthSq() < 1e-8) pole.set(0, 0, 1).addScaledVector(dir, -dir.z);
  pole.normalize();
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  elbow.copy(upper.position).addScaledVector(dir, l1 * cosA).addScaledVector(pole, l1 * sinA);

  // upper: rest bone direction → shoulder→elbow
  rest.copy(lower.position).normalize();
  seg.subVectors(elbow, upper.position).normalize();
  upper.quaternion.setFromUnitVectors(rest, seg);

  // lower: in upper's rotated frame, rest direction → elbow→target
  seg.copy(upper.position).addScaledVector(dir, d).sub(elbow);
  q.copy(upper.quaternion).invert();
  seg.applyQuaternion(q).normalize();
  rest.copy(end.position).normalize();
  lower.quaternion.setFromUnitVectors(rest, seg);
  return raw / (l1 + l2);
}

const pq = new Quaternion();

/** orient `obj` so its WORLD rotation equals `worldQ` (parent's matrixWorld must be current) */
export function alignWorld(obj: Object3D, worldQ: Quaternion): void {
  if (!obj.parent) {
    obj.quaternion.copy(worldQ);
    return;
  }
  obj.parent.updateWorldMatrix(true, false);
  obj.parent.getWorldQuaternion(pq);
  obj.quaternion.copy(pq.invert().multiply(worldQ));
}
