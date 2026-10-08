import type { Vector3 } from 'three';
import type { CamPose } from './camera-pose';

export interface OrbitOptions {
  /** horizontal distance (m) */
  radius?: number;
  /** height above the target (m) */
  height?: number;
  fov?: number;
  /** rad/s */
  speed?: number;
  /** starting angle (rad, 0 = looking from −Z toward +Z) */
  start?: number;
  /** look-at lift above the target (m) */
  lookUp?: number;
  /** tilt-shift strength (diorama title = strong, garage turntable = light) */
  tilt?: number;
}

/** A slow orbit for the title diorama and the garage turntable. */
export function orbitPose(target: Vector3, t: number, o: OrbitOptions, out: CamPose): CamPose {
  const r = o.radius ?? 26;
  const yaw = (o.start ?? 0.6) + t * (o.speed ?? 0.06);
  out.pos.set(target.x - Math.sin(yaw) * r, target.y + (o.height ?? 18), target.z - Math.cos(yaw) * r);
  out.target.set(target.x, target.y + (o.lookUp ?? 0), target.z);
  out.fov = o.fov ?? 34;
  out.roll = 0;
  out.tilt = o.tilt ?? 1;
  out.band = 0.16;
  out.feather = 0.3;
  return out;
}
