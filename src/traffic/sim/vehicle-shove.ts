import type { Vec2 } from '../../core/types';
import type { Vehicle } from './vehicle';

/**
 * Contact shove from the rider (TrafficQuery.nudge): a motorbike wobbles sideways and loses / gains speed along
 * its heading; a car barely notices (a fraction of the impulse on its speed, no sideways motion).
 */
export function shoveVehicle(v: Vehicle, impulse: Vec2): void {
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  const mass = v.isMoto ? 1 : 0.15;
  v.speed = Math.max(0, v.speed + (impulse.x * fx + impulse.z * fz) * mass);
  // left(θ) = (cos θ, −sin θ) = (fz, −fx): a push to the left raises the lateral offset
  if (v.isMoto) v.nudgeVel += impulse.x * fz - impulse.z * fx;
}

/** agents whose centre lies within r of p, written to `out` (TrafficQuery.near) */
export function agentsNear<T extends { pos: Vec2 }>(list: readonly T[], p: Vec2, r: number, out: T[]): number {
  out.length = 0;
  const r2 = r * r;
  for (const v of list) if ((v.pos.x - p.x) ** 2 + (v.pos.z - p.z) ** 2 <= r2) out.push(v);
  return out.length;
}
