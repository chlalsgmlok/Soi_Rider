import type { OBB, Vec2 } from './geometry';
import type { SurfaceKind } from './world';

export type BikeModelId = 'cub' | 'scooter' | 'sport';

export interface BikeStats {
  id: BikeModelId;
  name: string;
  model: string;
  /** m/s */
  topSpeed: number;
  /** m/s² at low speed */
  accel: number;
  /** m/s² max braking (dry) */
  brake: number;
  /** max steering angle at standstill (rad) */
  handling: number;
  wheelbase: number;
  length: number;
  /** body width without mirrors */
  width: number;
  /** total width incl. mirrors */
  mirrorSpan: number;
  /** mirror height (m) */
  mirrorY: number;
  /** mirror distance ahead of bike centre (m) */
  mirrorZ: number;
  mass: number;
}

/** Per-frame input snapshot produced by src/engine/input. Edge flags are true for exactly one frame. */
export interface PlayerInput {
  throttle: number;
  brake: number;
  /** -1..1, +1 = right */
  steer: number;
  tuck: boolean;
  hornPressed: boolean;
  interactPressed: boolean;
  cameraPressed: boolean;
  pausePressed: boolean;
  /** any key/button/touch this frame (for "press any key" prompts) */
  anyPressed: boolean;
  device: 'keyboard' | 'gamepad' | 'touch';
}

export interface PlayerState {
  pos: Vec2;
  heading: number;
  /** signed m/s along heading (negative = walking backwards) */
  speed: number;
  yawRate: number;
  /** current steering angle (rad), + = right */
  steer: number;
  /** visual lean (rad), + = leaning right */
  lean: number;
  /** pitch (rad), + = nose down (braking) */
  pitch: number;
  /** vertical bounce offset (m) */
  bounce: number;
  /** lateral slip angle (rad) when grip is exceeded */
  slip: number;
  tuck: boolean;
  surface: SurfaceKind;
  /** body hull (without mirrors) */
  obb: OBB;
  /** [left, right] mirror/bar-end boxes */
  mirrors: [OBB, OBB];
  /** effective full width now (mirrors, tuck, passenger bags) */
  width: number;
  fallen: boolean;
  /** seconds remaining in the fall/recovery sequence */
  fallTimer: number;
  /** riding against the lane direction */
  counterflow: boolean;
  /** against traffic but hugging the centre line (within SCORE.counterflowGraceM): tolerated, no penalty */
  centerline?: boolean;
  laneId: number;
  /** longitudinal acceleration this frame (m/s²) — comfort uses it */
  accel: number;
  /** feet down (speed < 2 m/s) */
  feetDown: boolean;
}

/** Gap to the nearest obstacle on each side of the rider (m). Infinity when nothing within 1.5 m. */
export interface ClearanceInfo {
  left: number;
  right: number;
  /** world points (on the obstacle) used to anchor the "( 6 cm )" brackets */
  leftPoint: Vec2 | null;
  rightPoint: Vec2 | null;
  /** obstacle ids for near-miss bookkeeping (-1 none) */
  leftId: number;
  rightId: number;
}
