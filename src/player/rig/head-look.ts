import { clamp } from '../../core/math2d';

/** the head turns at most this far into a corner (rad) */
export const HEAD_LOOK_MAX = 0.55;

/**
 * Head yaw into a turn (rad, + = the face turns LEFT, i.e. `head.rotation.y` on a rider facing +Z). Sim yawRate is
 * + while turning left and steering input is + to the right, so a left turn reads (+yaw, −steer): both terms agree.
 */
export function headLook(yawRate: number, steer: number): number {
  return clamp(yawRate * 0.3 - steer * 0.3, -HEAD_LOOK_MAX, HEAD_LOOK_MAX);
}
