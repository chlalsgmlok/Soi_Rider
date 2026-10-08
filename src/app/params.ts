import type { DistrictId, QualityPreset, TimeOfDay, TrafficIntensity, WeatherPlan } from '../core/types';
import { isQualityPreset } from '../engine/quality';
import { DISTRICT_IDS } from '../world/districts';

/** states `?skip=` can jump straight into (with sensible defaults for everything the skipped screens would choose) */
export type SkipTarget = 'title' | 'garage' | 'setup' | 'intro' | 'play' | 'results';
/** `?weather=`: a base sky, or a scripted trip (storm = early downpour, smog = early haze spike, calm = no events) */
export type WeatherParam = WeatherPlan['base'] | 'storm' | 'smog' | 'calm';

/** Debug / QA URL parameters (README › Debug parameters). Every field is optional in the URL. */
export interface AppParams {
  seed: number | null;
  district: DistrictId | null;
  intensity: TrafficIntensity | null;
  tod: TimeOfDay | null;
  weather: WeatherParam | null;
  skip: SkipTarget | null;
  /** autopilot: follows the route, auto-accepts the first call, hands over raincoats / masks */
  bot: boolean;
  /** forces a quality preset (otherwise Settings.quality) */
  quality: QualityPreset | null;
  /** offer index `?skip=play|results` accepts (default 0 = the first card) */
  job: number;
}

const SKIPS: readonly SkipTarget[] = ['title', 'garage', 'setup', 'intro', 'play', 'results'];
const INTENSITIES: readonly TrafficIntensity[] = ['light', 'rush', 'gridlock'];
const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const WEATHERS: readonly WeatherParam[] = ['clear', 'haze', 'overcast', 'storm', 'smog', 'calm'];

const pick = <T extends string>(list: readonly T[], v: string | null): T | null => list.find((x) => x === v) ?? null;

export function readParams(search: string): AppParams {
  const qs = new URLSearchParams(search);
  const seed = Number(qs.get('seed'));
  const job = Number(qs.get('job'));
  const q = qs.get('q');
  return {
    seed: qs.has('seed') && Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : null,
    district: pick(DISTRICT_IDS, qs.get('district')),
    intensity: pick(INTENSITIES, qs.get('intensity')),
    tod: pick(TODS, qs.get('tod')),
    weather: pick(WEATHERS, qs.get('weather')),
    skip: pick(SKIPS, qs.get('skip')),
    bot: qs.get('bot') === '1',
    quality: isQualityPreset(q) ? q : null,
    job: qs.has('job') && Number.isFinite(job) ? Math.max(0, Math.floor(job)) : 0,
  };
}
