import { Rng } from '../core/rng';
import type { DistrictId, Forecast, TimeOfDay, TrafficIntensity, WeatherPlan } from '../core/types';
import { DOWNPOUR_CHANCE } from './weather-plan';

/** "Today's Bangkok" forecast card on the Setup screen (docs/GAME_DESIGN.md §3, §7). Deterministic from (seed, trip). */

export const TOD_CHANCE: Record<TimeOfDay, number> = { morning: 0.2, noon: 0.25, sunset: 0.35, night: 0.2 };

/** base weather odds per time of day — morning smog, hot clear noons, cloudier nights */
export const BASE_WEATHER_CHANCE: Record<TimeOfDay, Record<WeatherPlan['base'], number>> = {
  morning: { clear: 0.4, haze: 0.35, overcast: 0.25 },
  noon: { clear: 0.6, haze: 0.2, overcast: 0.2 },
  sunset: { clear: 0.55, haze: 0.2, overcast: 0.25 },
  night: { clear: 0.45, haze: 0.25, overcast: 0.3 },
};

/** base haze/smog density range per base weather */
const HAZE_DENSITY: Record<WeatherPlan['base'], [number, number]> = {
  clear: [0.04, 0.14],
  haze: [0.45, 0.75],
  overcast: [0.15, 0.3],
};

/** district odds per time of day: malls at noon, Silom after work, Khaosan and Yaowarat come alive at night */
const DISTRICT_WEIGHT: Record<TimeOfDay, Record<DistrictId, number>> = {
  morning: { sukhumvit: 3, siam: 2, yaowarat: 2, khaosan: 1, silom: 2 },
  noon: { sukhumvit: 2, siam: 3, yaowarat: 2, khaosan: 1.5, silom: 2 },
  sunset: { sukhumvit: 2.5, siam: 2, yaowarat: 2, khaosan: 2, silom: 2.5 },
  night: { sukhumvit: 2, siam: 1.5, yaowarat: 3, khaosan: 3, silom: 2 },
};

export const DISTRICT_LABEL: Record<DistrictId, string> = {
  sukhumvit: '수쿰빗',
  siam: '시암',
  yaowarat: '야오와랏',
  khaosan: '카오산',
  silom: '실롬',
};

export const TOD_LABEL: Record<TimeOfDay, string> = { morning: '아침', noon: '한낮', sunset: '노을', night: '밤' };
const BASE_LABEL: Record<WeatherPlan['base'], string> = { clear: '맑음', haze: '연무 · 미세먼지 나쁨', overcast: '흐림' };
const RAIN_WHEN: Record<TimeOfDay, string> = { morning: '출근길', noon: '오후', sunset: '오후 늦게', night: '밤사이' };

const TODS = Object.keys(TOD_CHANCE) as TimeOfDay[];
const BASES = Object.keys(HAZE_DENSITY) as WeatherPlan['base'][];
const DISTRICTS = Object.keys(DISTRICT_LABEL) as DistrictId[];

/** e.g. "노을 · 맑음, 오후 늦게 소나기 가능성 45%" */
export function forecastSummary(tod: TimeOfDay, plan: WeatherPlan, intensity: TrafficIntensity): string {
  const sky = tod === 'noon' && plan.base === 'clear' ? '쨍한 하늘 · 폭염 주의' : BASE_LABEL[plan.base];
  const pct = Math.round(DOWNPOUR_CHANCE[intensity] * 100);
  return `${TOD_LABEL[tod]} · ${sky}, ${RAIN_WHEN[tod]} 소나기 가능성 ${pct}%`;
}

/**
 * Rolls the forecast for a trip. Trip 1 always starts at home in Sukhumvit (Soi 23 win stand).
 * `weather.events` is empty here — call finalizeWeather once the intensity is chosen.
 * `intensity` only affects the rain percentage in the summary (refresh it with forecastSummary when it changes).
 */
export function rollForecast(
  seed: number,
  tripNumber: number,
  rerollsLeft = 1,
  intensity: TrafficIntensity = 'rush',
): Forecast {
  const rng = new Rng(seed).fork(`forecast:${tripNumber}`);
  const timeOfDay = rng.weighted(TODS, (t) => TOD_CHANCE[t]);
  const base = rng.weighted(BASES, (b) => BASE_WEATHER_CHANCE[timeOfDay][b]);
  const [hLo, hHi] = HAZE_DENSITY[base];
  const weather: WeatherPlan = { base, haze: Math.round(rng.range(hLo, hHi) * 100) / 100, events: [] };
  const district = tripNumber <= 1 ? 'sukhumvit' : rng.weighted(DISTRICTS, (d) => DISTRICT_WEIGHT[timeOfDay][d]);
  return {
    seed,
    tripNumber,
    district,
    districtLabel: DISTRICT_LABEL[district],
    timeOfDay,
    weather,
    summary: forecastSummary(timeOfDay, weather, intensity),
    rerollsLeft: Math.max(0, Math.floor(rerollsLeft)),
  };
}

/**
 * The same forecast with its summary's rain chance for `intensity` (Setup: call on every intensity change, since
 * rollForecast / rerollForecast word the summary for 'rush' unless told otherwise). Nothing else changes.
 */
export const forecastForIntensity = (forecast: Forecast, intensity: TrafficIntensity): Forecast => ({
  ...forecast,
  summary: forecastSummary(forecast.timeOfDay, forecast.weather, intensity),
});

/** derived seeds a reroll tries before accepting a forecast that looks like the current one */
export const REROLL_TRIES = 8;

/**
 * Setup `다시 굴리기`: a fresh forecast for the same trip with one reroll fewer, or null when none are left.
 * Deterministic from the current forecast, and it prefers a result whose time of day, sky or district differs, so the
 * button never appears to do nothing. Trip 1 stays in Sukhumvit.
 */
export function rerollForecast(current: Forecast, intensity: TrafficIntensity = 'rush'): Forecast | null {
  if (current.rerollsLeft <= 0) return null;
  const rng = new Rng(current.seed).fork(`reroll:${current.tripNumber}:${current.rerollsLeft}`);
  let next: Forecast | null = null;
  for (let i = 0; i < REROLL_TRIES; i++) {
    next = rollForecast((rng.next() * 0x100000000) >>> 0, current.tripNumber, current.rerollsLeft - 1, intensity);
    const differs = next.timeOfDay !== current.timeOfDay || next.weather.base !== current.weather.base ||
      next.district !== current.district;
    if (differs) return next;
  }
  return next;
}
