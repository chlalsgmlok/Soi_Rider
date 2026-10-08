import type { CollisionKind } from '../core/events';
import type { ContactResponse } from './collision-types';

/** Per-kind contact tuning (feel): how much of the overlap the rider takes, how bouncy and lossy it is. */
export interface KindResponse extends ContactResponse {
  /** fraction of the penetration resolved by moving the rider (the rest is the other party's problem) */
  share: number;
  /** nudge impulse per m/s of closing speed handed to motos / pedestrians */
  shove: number;
  /** can a hard enough contact knock the rider down? */
  canFell: boolean;
}

export const RESPONSES: Readonly<Record<CollisionKind, KindResponse>> = {
  // a car doesn't move; the bike glances off with a jolt
  body: { share: 1, shove: 0, restitution: 0.12, speedLoss: 0.18, yawKick: 0.55, canFell: true },
  static: { share: 1, shove: 0, restitution: 0.1, speedLoss: 0.22, yawKick: 0.5, canFell: true },
  // mirrors flex: little speed loss but the bars get knocked off line
  mirror: { share: 1, shove: 0, restitution: 0.25, speedLoss: 0.05, yawKick: 0.8, canFell: false },
  // another moto shares the push
  moto: { share: 0.55, shove: 0.5, restitution: 0.2, speedLoss: 0.12, yawKick: 0.45, canFell: true },
  // people get bumped aside; the rider brakes into them
  pedestrian: { share: 0.3, shove: 0.7, restitution: 0, speedLoss: 0.3, yawKick: 0.15, canFell: true },
  curb: { share: 1, shove: 0, restitution: 0, speedLoss: 0.08, yawKick: 0, canFell: false },
};
