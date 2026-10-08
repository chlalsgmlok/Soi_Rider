import { RIDE } from '../core/config/bikes';
import { G } from '../core/math2d';
import type { BikeStats } from '../core/types';

/** engine braking when above the (tuck) speed cap, m/s² */
const OVERSPEED_DECEL = 1.8;

/**
 * RIDE.drag is read as the lift-off (closed throttle) decel coefficient at full scale; this share of it makes
 * coasting feel like engine braking (≈0.9 m/s² at 40 km/h, ≈1.9 at 70) instead of a parachute.
 */
const AERO_SCALE = 0.35;

/** aerodynamic + rolling resistance incl. engine braking (m/s², ≥ 0, opposes motion) */
export const resistance = (v: number): number =>
  RIDE.drag * AERO_SCALE * v * v + RIDE.rolling * Math.min(1, Math.abs(v) / 0.5);

/** the speed cap right now: a tucked rider creeps at RIDE.tuckTopSpeed */
export const speedCap = (stats: BikeStats, tuck: boolean): number =>
  tuck ? Math.min(stats.topSpeed, RIDE.tuckTopSpeed) : stats.topSpeed;

/**
 * Strongest braking the tyres allow: the bike's brakes scale down with grip (a wet road locks earlier) and can
 * never beat μ·g. `load` (0..1 passenger mass) lengthens stops a little.
 */
export function brakeLimit(stats: BikeStats, mu: number, load = 0): number {
  return Math.min(stats.brake * (mu / RIDE.gripDry), mu * G) / (1 + 0.12 * load);
}

/**
 * Forward drive (m/s²) for throttle 0..1 at speed v ≥ 0. The curve fades toward the cap so the bike settles
 * exactly at it: D(v) = throttle·[accel·(1 − (v/cap)²) + R(v)] → at full throttle net accel = accel·(1 − (v/cap)²).
 */
export function drive(stats: BikeStats, throttle: number, v: number, cap: number, load = 0): number {
  if (throttle <= 0) return 0;
  const accel = stats.accel / (1 + 0.25 * load);
  if (v >= cap) return 0;
  const r = v / cap;
  return throttle * (accel * (1 - r * r) + resistance(v));
}

/**
 * Longitudinal acceleration (m/s²) for a forward-rolling bike (v ≥ 0): drive − resistance − brakes, plus engine
 * braking above the cap. The caller clamps the speed at zero (brakes never reverse the bike).
 */
export function forwardAccel(
  stats: BikeStats, throttle: number, brake: number, v: number, mu: number, tuck: boolean, load = 0,
): number {
  const cap = speedCap(stats, tuck);
  let a = drive(stats, throttle, v, cap, load) - (v > 0 ? resistance(v) : 0);
  if (v > cap) a -= OVERSPEED_DECEL * Math.min(1, (v - cap) / 2);
  if (brake > 0 && v > 0) a -= brakeLimit(stats, mu, load) * brake;
  return a;
}
