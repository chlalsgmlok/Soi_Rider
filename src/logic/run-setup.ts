import { INTENSITY } from '../core/config/traffic';
import { Rng } from '../core/rng';
import type { Forecast, Loadout, RunConfig, SaveData, TrafficIntensity } from '../core/types';
import { finalizeWeather } from './weather-plan';

/** From the Setup screen to a running trip (docs/GAME_DESIGN.md §2 Setup, §3, §7, §9). */

/** the trip about to start — `TRIP 01` on a fresh profile */
export const nextTripNumber = (save: SaveData): number => save.tripsCompleted + 1;

/**
 * §9: ETA = route length / the intensity's reference speed (light 22 · rush 14 · gridlock 9 km/h), in whole seconds
 * (at least 1). Pass the metres of the leg the run clock times; the timeout is 2.5 × this.
 */
export function etaSeconds(routeMeters: number, intensity: TrafficIntensity): number {
  const meters = Number.isFinite(routeMeters) ? Math.max(0, routeMeters) : 0;
  return Math.max(1, Math.round(meters / INTENSITY[intensity].etaSpeed));
}

/**
 * Freezes the Setup choices into the run config: the forecast's time of day and district plus the weather events rolled
 * for the chosen intensity. Deterministic for (forecast.seed, trip, intensity); every system then forks its own stream
 * from `seed`. A heavier intensity never removes a downpour the lighter one would have had (same roll, higher odds).
 */
export function createRunConfig(forecast: Forecast, intensity: TrafficIntensity, loadout: Loadout): RunConfig {
  const rng = new Rng(forecast.seed).fork(`weather:${forecast.tripNumber}`);
  return {
    seed: forecast.seed,
    tripNumber: forecast.tripNumber,
    intensity,
    timeOfDay: forecast.timeOfDay,
    weather: finalizeWeather(forecast.weather, intensity, rng),
    district: forecast.district,
    loadout: { ...loadout },
  };
}
