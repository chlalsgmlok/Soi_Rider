import { CAMERA } from '../core/config/camera';
import { clamp, KMH } from '../core/math2d';
import type { PlayerState } from '../core/types';
import type { CamPose } from './camera-pose';

/** extra diorama yaw so streets run diagonally across the frame like mockup 03 (rad, + = camera swings left) */
export const DIORAMA_YAW = -0.3;
/** POV looks this far below the horizon: dash ≈ ¼ up the frame, mirrors at mid-height (mockup 02) */
const POV_PITCH = 0.2;

/** inputs every framing needs */
export interface FrameInput {
  s: PlayerState;
  /** lagged heading the chase cameras orbit with */
  yaw: number;
  /** ground height under the bike */
  ground: number;
  /** seconds (bob phase) */
  time: number;
  /** diorama yaw offset this frame (DIORAMA_YAW on open roads, swung toward the street axis in narrow sois) */
  yawOffset: number;
}

const boom = { back: 0, up: 0 };

/** diorama boom length / height for a speed (m/s): pulled back and up as the bike speeds up (shared object) */
export function dioramaBoom(speed: number): { readonly back: number; readonly up: number } {
  const d = CAMERA.diorama;
  const k = clamp(Math.abs(speed) / (60 / KMH), 0, 1);
  boom.back = d.back + d.speedPullBack * k;
  boom.up = d.up + d.speedPullBack * 0.8 * k;
  return boom;
}

/**
 * Diorama (docs/GAME_DESIGN.md §12, mockup 03): high 3/4 chase, 11 m back / 12 m up, fov 36, pulled back up to 3 m
 * with speed; looks a little ahead of the bike so it sits in the lower third inside the sharp tilt-shift band.
 */
export function dioramaPose(f: FrameInput, out: CamPose): CamPose {
  const d = CAMERA.diorama;
  const k = clamp(Math.abs(f.s.speed) / (60 / KMH), 0, 1);
  const { back, up } = dioramaBoom(f.s.speed);
  const yaw = f.yaw + f.yawOffset;
  const ahead = d.lookAhead * (0.45 + 0.35 * k);
  const fx = Math.sin(f.yaw);
  const fz = Math.cos(f.yaw);
  out.pos.set(f.s.pos.x - Math.sin(yaw) * back, f.ground + up, f.s.pos.z - Math.cos(yaw) * back);
  out.target.set(f.s.pos.x + fx * ahead, f.ground + 0.6, f.s.pos.z + fz * ahead);
  out.fov = d.fov;
  out.roll = 0;
  out.tilt = d.tiltShift;
  out.band = 0.14;
  out.feather = 0.27;
  return out;
}

/** Squeeze: low close chase for tight gaps (fov 52, 3.4 m back, 2.3 m up), light tilt-shift */
export function squeezePose(f: FrameInput, out: CamPose): CamPose {
  const d = CAMERA.squeeze;
  const fx = Math.sin(f.yaw);
  const fz = Math.cos(f.yaw);
  out.pos.set(f.s.pos.x - fx * d.back, f.ground + d.up, f.s.pos.z - fz * d.back);
  out.target.set(f.s.pos.x + fx * d.lookAhead, f.ground + 0.85, f.s.pos.z + fz * d.lookAhead);
  out.fov = d.fov;
  out.roll = f.s.lean * 0.12;
  out.tilt = d.tiltShift;
  out.band = 0.22;
  out.feather = 0.3;
  return out;
}

/**
 * POV (mockup 02): the rider's eyes — the head follows the bike's lean (rolled 0.6×, so the horizon tilts less
 * than the bike), dips with brake dive and bounce, bobs with speed and glances into turns.
 */
export function povPose(f: FrameInput, out: CamPose): CamPose {
  const d = CAMERA.pov;
  const s = f.s;
  const lean = s.lean * 1.05;
  const h = s.heading + clamp(s.yawRate * 0.12, -0.2, 0.2);
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const rx = -Math.cos(s.heading);
  const rz = Math.sin(s.heading);
  const v = Math.min(1, Math.abs(s.speed) / 12);
  const bob = d.bob * v * (Math.sin(f.time * 10.5) * 0.6 + Math.sin(f.time * 3.1) * 0.4);
  const side = Math.sin(lean) * d.eyeUp; // the head swings with the lean (+ = right)
  const back = d.eyeBack - s.pitch * 0.6;
  const y = f.ground + Math.cos(lean) * d.eyeUp + s.bounce + bob - s.pitch * 0.25 - (s.tuck ? 0.18 : 0);
  out.pos.set(s.pos.x + rx * side - fx * back, y, s.pos.z + rz * side - fz * back);
  const reach = 20;
  out.target.set(out.pos.x + Math.sin(h) * reach, y - Math.tan(POV_PITCH + s.pitch * 0.8) * reach, out.pos.z + Math.cos(h) * reach);
  out.fov = d.fov;
  out.roll = s.lean * d.rollFactor;
  out.tilt = d.tiltShift;
  out.band = 0.3;
  out.feather = 0.3;
  return out;
}
