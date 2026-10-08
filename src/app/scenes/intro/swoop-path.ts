import { blendPose, type CamPose } from '../../../camera';
import { clamp } from '../../../core/math2d';

/** share of the swoop spent craning up to the establishing shot (the rest swoops down onto the ride framing) */
export const RISE = 0.42;
/** sideways bulge of the descent (m) — a swoop, not an elevator */
export const ARC = 5;

/** signed arc so the descent bulges away from `around` (the rider): the camera swings round behind, not across */
export function arcAway(high: CamPose, ride: CamPose, around: { x: number; z: number }, arc = ARC): number {
  const dx = ride.pos.x - high.pos.x;
  const dz = ride.pos.z - high.pos.z;
  const mx = (high.pos.x + ride.pos.x) / 2 - around.x;
  const mz = (high.pos.z + ride.pos.z) / 2 - around.z;
  return -dz * mx + dx * mz >= 0 ? arc : -arc;
}

/** sine ease-in-out on 0..1 */
export const easeInOut = (u: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));

/**
 * The accept swoop at progress `u` (0..1): crane up from the stand shot to the establishing high shot (eased, so it
 * hangs there a beat), then swoop down onto the ride framing along a sideways arc of `arc` metres (+ = to the left of
 * the high→ride direction). Lens and tilt-shift blend along.
 */
export function swoopPose(stand: CamPose, high: CamPose, ride: CamPose, u: number, out: CamPose, arc = ARC): CamPose {
  if (u < RISE) return blendPose(stand, high, easeInOut(u / RISE), out);
  const v = easeInOut((u - RISE) / (1 - RISE));
  blendPose(high, ride, v, out);
  const dx = ride.pos.x - high.pos.x;
  const dz = ride.pos.z - high.pos.z;
  const len = Math.hypot(dx, dz);
  if (len > 1e-6) {
    const bulge = Math.sin(Math.PI * v) * arc;
    out.pos.x += (-dz / len) * bulge;
    out.pos.z += (dx / len) * bulge;
  }
  return out;
}
