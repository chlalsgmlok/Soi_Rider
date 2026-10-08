import { RIDE } from '../core/config/bikes';
import { clamp, G, KMH, lerp, yawRateFor } from '../core/math2d';
import type { BikeStats } from '../core/types';

const V60 = 60 / KMH;
/** full steering travel takes this long (s) whatever the speed — keyboards feel the same at 10 and 60 km/h */
export const STEER_TIME = 0.2;
export const STEER_TIME_TUCK = 0.34;
/** at the steering limit the dry tyres are asked for this much of their grip (> 1 = a hint of understeer) */
const DRY_REACH = 1.04;

/**
 * Largest steering angle at a speed: BikeStats.handling at a standstill easing to RIDE.steerAtSpeed at 60 km/h
 * (docs/GAME_DESIGN.md §5), and never much more than DRY tyres can hold — so dry turns are crisp at the limit
 * while a wet road (lower μ) slides when you ask for the same line.
 */
export function maxSteerAt(stats: BikeStats, speed: number): number {
  const v = Math.abs(speed);
  const t = clamp(v / V60, 0, 1);
  const curve = lerp(stats.handling, RIDE.steerAtSpeed, 1 - (1 - t) * (1 - t));
  if (v < 0.5) return curve;
  const grip = Math.atan((stats.wheelbase * RIDE.gripDry * G * DRY_REACH) / (v * v));
  return Math.min(curve, grip);
}

/** move the steering angle toward input × max with a travel time independent of speed */
export function steerToward(current: number, input: number, max: number, tuck: boolean, dt: number): number {
  const target = clamp(input, -1, 1) * max;
  const rate = (Math.max(max, 0.08) / (tuck ? STEER_TIME_TUCK : STEER_TIME)) * dt;
  return clamp(current + clamp(target - current, -rate, rate), -max, max);
}

/** result of the grip-limited yaw (allocation-free scratch) */
export interface GripYaw {
  yawRate: number;
  /** 0 = within grip; > 0 = asked for this fraction more lateral grip than available */
  overshoot: number;
}

/**
 * Bicycle yaw rate limited by the friction circle: lateral accel |v·r| ≤ √((μg)² − a_long²). Past the limit the
 * yaw is clamped (understeer: the bike runs wide) and `overshoot` drives slip angle, scrub and tyre squeal.
 */
export function gripYaw(speed: number, steer: number, wheelbase: number, mu: number, aLong: number, out: GripYaw): GripYaw {
  const want = yawRateFor(speed, steer, wheelbase);
  const lim = mu * G;
  const avail = Math.sqrt(Math.max(lim * lim * 0.04, lim * lim - aLong * aLong));
  const lat = Math.abs(speed * want);
  if (lat <= avail || Math.abs(speed) < 0.3) {
    out.yawRate = want;
    out.overshoot = 0;
  } else {
    out.yawRate = (Math.sign(want) * avail) / Math.abs(speed);
    out.overshoot = lat / avail - 1;
  }
  return out;
}
