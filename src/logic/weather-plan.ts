import type { Rng } from '../core/rng';
import type { TrafficIntensity, WeatherEvent, WeatherPlan } from '../core/types';

/** Weather events of a run (docs/GAME_DESIGN.md §7), rolled once the traffic intensity is known. */

/** downpour probability per traffic intensity */
export const DOWNPOUR_CHANCE: Record<TrafficIntensity, number> = { light: 0.35, rush: 0.45, gridlock: 0.5 };

/** smog spike probability by base weather — hazy days spike far more often */
export const HAZE_SPIKE_CHANCE: Record<WeatherPlan['base'], number> = { clear: 0.2, haze: 0.7, overcast: 0.25 };

export const DOWNPOUR = { fromProgress: 0.3, toProgress: 0.7, minSec: 60, maxSec: 120, minIntensity: 0.7 } as const;
export const HAZE_SPIKE = { fromProgress: 0.15, toProgress: 0.85, minSec: 25, maxSec: 50, minIntensity: 0.5 } as const;
/** a smog spike never starts within this progress distance of a downpour (rain washes the smog out) */
export const EVENT_SPACING = 0.25;

/**
 * Returns a copy of the plan with its events rolled for this intensity. Idempotent: existing events are replaced,
 * base weather and haze density are kept. Events are sorted by `atProgress`.
 */
export function finalizeWeather(plan: WeatherPlan, intensity: TrafficIntensity, rng: Rng): WeatherPlan {
  const events: WeatherEvent[] = [];
  const rainRoll = rng.next();
  const hazeRoll = rng.next();

  let downpour: WeatherEvent | null = null;
  if (rainRoll < DOWNPOUR_CHANCE[intensity]) {
    downpour = {
      kind: 'downpour',
      atProgress: rng.range(DOWNPOUR.fromProgress, DOWNPOUR.toProgress),
      duration: Math.round(rng.range(DOWNPOUR.minSec, DOWNPOUR.maxSec)),
      intensity: rng.range(DOWNPOUR.minIntensity, 1),
    };
    events.push(downpour);
  }

  if (hazeRoll < HAZE_SPIKE_CHANCE[plan.base]) {
    events.push({
      kind: 'haze_spike',
      atProgress: hazeStart(rng, downpour),
      duration: Math.round(rng.range(HAZE_SPIKE.minSec, HAZE_SPIKE.maxSec)),
      intensity: rng.range(HAZE_SPIKE.minIntensity, 1),
    });
  }

  events.sort((a, b) => a.atProgress - b.atProgress);
  return { base: plan.base, haze: plan.haze, events };
}

function hazeStart(rng: Rng, downpour: WeatherEvent | null): number {
  const { fromProgress: lo, toProgress: hi } = HAZE_SPIKE;
  if (!downpour) return rng.range(lo, hi);
  const before = downpour.atProgress - EVENT_SPACING;
  const after = downpour.atProgress + EVENT_SPACING;
  const roomBefore = Math.max(0, before - lo);
  const roomAfter = Math.max(0, hi - after);
  if (roomBefore + roomAfter <= 0) return lo;
  const r = rng.range(0, roomBefore + roomAfter);
  return r < roomBefore ? lo + r : after + (r - roomBefore);
}
