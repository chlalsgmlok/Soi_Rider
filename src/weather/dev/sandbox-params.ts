import type { DistrictId, QualityPreset, TimeOfDay, TrafficIntensity, WeatherPlan } from '../../core/types';
import { isQualityPreset } from '../../engine/quality';
import { DISTRICT_IDS } from '../../world';

export type SandboxWeather = 'clear' | 'haze' | 'rain' | 'storm';
/** 'side' = a low chase view from the road side (clear of curbside trees) for splash / spray close-ups */
export type SandboxCam = 'diorama' | 'pov' | 'side';
export const SANDBOX_CAMS: readonly SandboxCam[] = ['diorama', 'pov', 'side'];

export interface WeatherSandboxParams {
  seed: number;
  district: DistrictId;
  tod: TimeOfDay;
  weather: SandboxWeather;
  /** seconds of weather timeline pre-rolled before the first frame */
  t: number;
  cam: SandboxCam;
  quality: QualityPreset;
  intensity: TrafficIntensity;
  /** 0 = weather FX hidden (perf A/B) */
  fx: boolean;
  /** 0 = the rider waits at its spot */
  ride: boolean;
  hud: boolean;
  /** seconds of traffic warm-up */
  warm: number;
}

const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const WEATHERS: readonly SandboxWeather[] = ['clear', 'haze', 'rain', 'storm'];
const INTENSITIES: readonly TrafficIntensity[] = ['light', 'rush', 'gridlock'];

export function sandboxParams(search: string): WeatherSandboxParams {
  const qs = new URLSearchParams(search);
  const num = (k: string, d: number): number => (qs.has(k) && Number.isFinite(Number(qs.get(k))) ? Number(qs.get(k)) : d);
  const q = qs.get('q');
  return {
    seed: num('seed', 7),
    district: DISTRICT_IDS.find((d) => d === qs.get('district')) ?? 'sukhumvit',
    tod: TODS.find((t) => t === qs.get('tod')) ?? 'sunset',
    weather: WEATHERS.find((w) => w === qs.get('weather')) ?? 'clear',
    t: Math.max(0, num('t', 0)),
    cam: SANDBOX_CAMS.find((c) => c === qs.get('cam')) ?? 'diorama',
    quality: isQualityPreset(q) ? q : 'medium',
    intensity: INTENSITIES.find((i) => i === qs.get('intensity')) ?? 'rush',
    fx: qs.get('fx') !== '0',
    ride: qs.get('ride') !== '0',
    hud: qs.get('hud') !== '0',
    warm: num('warm', 20),
  };
}

/**
 * The run plan for a sandbox weather: 'rain' / 'storm' open with a downpour (storm = heavier, more thunder, on an
 * overcast day), 'haze' is a smoggy day with a spike, 'clear' has no event (trigger them with the keys).
 */
export function sandboxPlan(w: SandboxWeather): WeatherPlan {
  switch (w) {
    case 'rain':
      return { base: 'clear', haze: 0.1, events: [{ kind: 'downpour', atProgress: 0, duration: 110, intensity: 0.88 }] };
    case 'storm':
      return { base: 'overcast', haze: 0.18, events: [{ kind: 'downpour', atProgress: 0, duration: 150, intensity: 1 }] };
    case 'haze':
      return { base: 'haze', haze: 0.55, events: [{ kind: 'haze_spike', atProgress: 0, duration: 60, intensity: 1 }] };
    default:
      return { base: 'clear', haze: 0.08, events: [] };
  }
}
