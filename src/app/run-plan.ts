import type { Forecast, Loadout, RunConfig, SaveData, TrafficIntensity, WeatherEvent, WeatherPlan } from '../core/types';
import { createRunConfig, DISTRICT_LABEL, forecastSummary, nextTripNumber, rerollForecast, rollForecast } from '../logic';
import type { AppParams, WeatherParam } from './params';

/** base smog density when `?weather=` forces a sky the roll did not pick */
const HAZE_FOR: Record<WeatherPlan['base'], number> = { clear: 0.08, haze: 0.45, overcast: 0.14 };

/** a fresh trip seed: the URL's, else a random 32-bit value (every trip is a new Bangkok) */
export function tripSeed(params: AppParams): number {
  return params.seed ?? (Math.random() * 0x100000000) >>> 0;
}

/** Setup's forecast for the next trip, with the debug overrides (?district ?tod ?weather) applied */
export function forecastFor(save: SaveData, params: AppParams, intensity: TrafficIntensity): Forecast {
  return withOverrides(rollForecast(tripSeed(params), nextTripNumber(save), 1, intensity), params, intensity);
}

/** `다시 굴리기` (null when no reroll is left); URL overrides stay pinned */
export function rerolled(current: Forecast, params: AppParams, intensity: TrafficIntensity): Forecast | null {
  const next = rerollForecast(current, intensity);
  return next ? withOverrides(next, params, intensity) : null;
}

/** freezes the Setup choices into the run (weather events rolled for the intensity, or scripted by ?weather=) */
export function runConfigFor(forecast: Forecast, intensity: TrafficIntensity, loadout: Loadout, params: AppParams): RunConfig {
  const config = createRunConfig(forecast, intensity, loadout);
  const events = scripted(params.weather);
  return events ? { ...config, weather: { ...config.weather, events } } : config;
}

function withOverrides(f: Forecast, p: AppParams, intensity: TrafficIntensity): Forecast {
  const district = p.district ?? f.district;
  const timeOfDay = p.tod ?? f.timeOfDay;
  const base = baseFor(p.weather) ?? f.weather.base;
  const weather: WeatherPlan = { ...f.weather, base, haze: base === f.weather.base ? f.weather.haze : HAZE_FOR[base] };
  return { ...f, district, districtLabel: DISTRICT_LABEL[district], timeOfDay, weather, summary: forecastSummary(timeOfDay, weather, intensity) };
}

function baseFor(w: WeatherParam | null): WeatherPlan['base'] | null {
  if (w === 'storm') return 'overcast';
  if (w === 'smog') return 'haze';
  return w === 'clear' || w === 'haze' || w === 'overcast' ? w : null;
}

function scripted(w: WeatherParam | null): WeatherEvent[] | null {
  if (w === 'storm') return [{ kind: 'downpour', atProgress: 0.2, duration: 80, intensity: 0.9 }];
  if (w === 'smog') return [{ kind: 'haze_spike', atProgress: 0.12, duration: 45, intensity: 0.8 }];
  if (w === 'calm') return [];
  return null;
}
