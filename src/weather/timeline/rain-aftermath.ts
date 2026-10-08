import { clamp } from '../../core/math2d';

/**
 * How rain lingers after it falls (pure integrators, frame-rate independent):
 *  - road wetness soaks up within seconds of heavy rain and dries SLOWLY afterwards (≈ 2 min in daylight,
 *    ≈ 4 min at night) — puddles, dark asphalt and low grip outlast the shower;
 *  - smog washout: rain scrubs the PM2.5 out of the air and the city takes a minute to smog up again.
 */
export const AFTERMATH = {
  /** rain below this counts as dry */
  rainEps: 0.02,
  /** seconds⁻¹ drying rate in full sun / at night (scaled by 0.35 + 0.65·wetness) */
  dryDay: 1 / 70,
  dryNight: 1 / 170,
  /** washout rises at rate·rain, decays at this rate */
  washRise: 0.6,
  washFall: 1 / 80,
} as const;

/** wetness the rain is heading for: drizzle darkens the road, a downpour soaks it */
export const wetTarget = (rain: number): number => (rain > AFTERMATH.rainEps ? Math.min(1, 0.4 + 0.75 * rain) : 0);

/**
 * Advance road wetness. `sun` 0..1 = drying power (daylight × clear sky).
 * Rain wets the road toward wetTarget(rain); while it keeps raining the road never dries below that.
 */
export function stepWetness(wetness: number, rain: number, sun: number, dt: number): number {
  const w = clamp(wetness, 0, 1);
  const target = wetTarget(rain);
  if (w < target) return w + (target - w) * (1 - Math.exp(-(0.35 + 0.6 * rain) * dt));
  const dry = (AFTERMATH.dryNight + (AFTERMATH.dryDay - AFTERMATH.dryNight) * clamp(sun, 0, 1)) * (0.35 + 0.65 * w);
  // drizzle on a soaked road: it only drains slowly toward the drizzle level
  const rate = target > 0 ? dry * 0.3 : dry;
  return Math.max(target, w - dt * rate);
}

/** Advance the smog washout factor 0..1 (haze is multiplied by 1 − 0.6·washout). */
export function stepWashout(wash: number, rain: number, dt: number): number {
  const w = clamp(wash, 0, 1);
  if (rain > AFTERMATH.rainEps) return w + (1 - w) * (1 - Math.exp(-AFTERMATH.washRise * rain * dt));
  return Math.max(0, w - dt * AFTERMATH.washFall);
}
