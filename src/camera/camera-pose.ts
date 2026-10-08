import { type PerspectiveCamera, Vector3 } from 'three';
import type { PostFxParams } from '../engine/post/post-params';

/** what the camera rig hands to PostFx each frame */
export type CameraPost = Pick<PostFxParams, 'tiltShift' | 'focusY' | 'focusBand' | 'focusFeather'>;

/** A framing: where the camera is, what it looks at, lens + roll, and its post (tilt-shift) look. */
export interface CamPose {
  pos: Vector3;
  target: Vector3;
  fov: number;
  /** roll about the view axis (rad, + = horizon tilts clockwise / camera rolls right) */
  roll: number;
  tilt: number;
  band: number;
  feather: number;
}

export const newPose = (): CamPose => ({
  pos: new Vector3(), target: new Vector3(), fov: 50, roll: 0, tilt: 0, band: 0.2, feather: 0.3,
});

export function copyPose(out: CamPose, a: CamPose): CamPose {
  out.pos.copy(a.pos);
  out.target.copy(a.target);
  out.fov = a.fov;
  out.roll = a.roll;
  out.tilt = a.tilt;
  out.band = a.band;
  out.feather = a.feather;
  return out;
}

/** linear blend of two framings (t = 0 → a) */
export function blendPose(a: CamPose, b: CamPose, t: number, out: CamPose): CamPose {
  out.pos.lerpVectors(a.pos, b.pos, t);
  out.target.lerpVectors(a.target, b.target, t);
  out.fov = a.fov + (b.fov - a.fov) * t;
  out.roll = a.roll + (b.roll - a.roll) * t;
  out.tilt = a.tilt + (b.tilt - a.tilt) * t;
  out.band = a.band + (b.band - a.band) * t;
  out.feather = a.feather + (b.feather - a.feather) * t;
  return out;
}

/** place a PerspectiveCamera on a pose (lookAt, then roll about the view axis) */
export function applyPose(camera: PerspectiveCamera, p: CamPose): void {
  camera.position.copy(p.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(p.target);
  if (p.roll !== 0) camera.rotateZ(-p.roll);
  if (Math.abs(camera.fov - p.fov) > 1e-4) {
    camera.fov = p.fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

const ndc = new Vector3();

/** screen-UV height (0 bottom … 1 top) of a world point for the camera's current matrices */
export function screenY(camera: PerspectiveCamera, world: Vector3): number {
  ndc.copy(world).project(camera);
  return Math.min(0.95, Math.max(0.05, (ndc.y + 1) / 2));
}
