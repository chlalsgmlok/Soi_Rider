import { damp, KMH } from '../../core/math2d';
import type { TrafficPlayer } from '../sim/types';
import type { Pedestrian } from './pedestrian';

/** the rider must be at least this fast to scare anyone (m/s ≈ 16 km/h) */
const SCARE_SPEED = 4.5;
/** jump-back speed (m/s) */
const JUMP = 2.6;
const COOLDOWN = 4;

/**
 * Startle when the rider comes at a pedestrian fast: inside a short cone ahead of the bike (closer at low speed),
 * the pedestrian jumps sideways out of the bike's line. Returns the rider speed (km/h) when this counts as a new
 * scare (cooldown per pedestrian), else 0. `dt` also fades the startle and the push.
 */
export function checkStartle(p: Pedestrian, player: TrafficPlayer, dt: number): number {
  p.scareCooldown -= dt;
  p.startled = Math.max(0, p.startled - dt * 0.8);
  const k = damp(3.2, dt);
  p.pushX -= p.pushX * k;
  p.pushZ -= p.pushZ * k;
  const v = player.speed;
  if (v < SCARE_SPEED) return 0;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  const rx = p.pos.x - player.pos.x;
  const rz = p.pos.z - player.pos.z;
  const along = rx * fx + rz * fz;
  const right = -rx * fz + rz * fx;
  if (along < 0 || along > 1.2 + v * 0.45 || Math.abs(right) > 1.25) return 0;
  const away = right >= 0 ? 1 : -1;
  // right(θ) = (−fz, fx)
  p.pushX = -fz * away * JUMP;
  p.pushZ = fx * away * JUMP;
  p.startled = 1;
  if (p.scareCooldown > 0) return 0;
  p.scareCooldown = COOLDOWN;
  return v * KMH;
}

/** contact shove (TrafficQuery.nudge): a stumble in the push direction */
export function shove(p: Pedestrian, ix: number, iz: number): void {
  const mag = Math.hypot(ix, iz);
  if (mag < 1e-6) return;
  const k = Math.min(3, mag) / mag;
  p.pushX += ix * k;
  p.pushZ += iz * k;
  p.startled = 1;
}

/** integrate the push into a displacement that drifts back to the walking line over a few seconds */
export function applyPush(p: Pedestrian, dt: number): void {
  const back = damp(0.7, dt);
  p.dispX += p.pushX * dt - p.dispX * back;
  p.dispZ += p.pushZ * dt - p.dispZ * back;
  p.pos.x += p.dispX;
  p.pos.z += p.dispZ;
}
