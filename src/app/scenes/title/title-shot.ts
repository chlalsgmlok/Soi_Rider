import type { Vec2 } from '../../../core/types';

/** Art direction of the title camera (an orbit around the hero rider, who stays put on screen). */
export interface TitleShot {
  /** orbit target relative to the hero in the camera's yaw frame: metres ahead (into the shot) and to the left */
  ahead: number;
  left: number;
  /** horizontal distance and height of the camera above the target (pitch = atan(height / radius)) */
  radius: number;
  height: number;
  fov: number;
  /**
   * yaw offset from the approach heading (rad, + = look further left). π + a bit: from above the junction mouth, look
   * back down the approach — the queue faces the camera, the hero's kerb and its shop fronts on the right
   */
  yaw: number;
  /** slow cinematic sweep: amplitude (rad) and period (s) */
  sweep: number;
  sweepPeriod: number;
  /** dolly in/out breathing: fraction of the radius and period (s) */
  dolly: number;
  dollyPeriod: number;
  /** mouse parallax at the screen edge: yaw (rad) and crane (m) */
  parallaxYaw: number;
  parallaxUp: number;
  /** miniature look: sharp band half-height and ramp (screen fractions); the band centre sits `focusLift` above the hero */
  band: number;
  feather: number;
  focusLift: number;
}

/** mockup 03: from above the junction mouth, a high three-quarter look down the queued approach at the rider */
export const TITLE_SHOT: Readonly<TitleShot> = {
  ahead: 3.5,
  left: 4,
  radius: 16,
  height: 12.5,
  fov: 36,
  yaw: Math.PI + 0.25,
  sweep: 0.2,
  sweepPeriod: 90,
  dolly: 0.06,
  dollyPeriod: 47,
  parallaxYaw: 0.035,
  parallaxUp: 0.8,
  band: 0.13,
  feather: 0.26,
  focusLift: 0.1,
};

/** camera yaw (the direction it looks) for a sweep phase −1..1 */
export const shotYaw = (heading: number, shot: TitleShot, phase: number): number => heading + shot.yaw + phase * shot.sweep;

/** orbit target on the ground for a camera yaw: the hero offset so it sits right of centre in the lower third */
export function shotTarget(hero: Vec2, yaw: number, shot: TitleShot): Vec2 {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return { x: hero.x + fx * shot.ahead + fz * shot.left, z: hero.z + fz * shot.ahead - fx * shot.left };
}

/** camera position for a target + yaw (orbit convention of src/camera/orbit.ts) */
export function shotCamera(target: Vec2, yaw: number, shot: TitleShot, ground = 0): { x: number; y: number; z: number } {
  return { x: target.x - Math.sin(yaw) * shot.radius, y: ground + shot.height, z: target.z - Math.cos(yaw) * shot.radius };
}
