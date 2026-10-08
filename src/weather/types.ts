import type { WeatherEvent, WeatherKind } from '../core/types';

/** What the weather timeline is doing right now. */
export type WeatherPhase =
  /** base weather of the run (clear / haze / overcast), no event running */
  | 'calm'
  /** the 6 s before a downpour: sky darkens, gust front, first drops, thunder */
  | 'buildup'
  /** full rain */
  | 'downpour'
  /** rain easing off */
  | 'taper'
  /** the rain stopped: clouds lifting, roads drying, steam */
  | 'after'
  /** a smog spike is on (bus/truck exhaust, yellow-grey haze, orange sun) */
  | 'smog';

/**
 * Live weather for gameplay and presentation (mission prompts/comfort, audio, HUD, city wetness, grip).
 * Every number is 0..1 unless noted.
 */
export interface WeatherState {
  /** headline weather: 'rain' from the first build-up second until the taper ends, 'haze' during a smog spike */
  kind: WeatherKind;
  phase: WeatherPhase;
  /** the event driving the phase, or null */
  event: WeatherEvent['kind'] | null;
  /** cloud deck (Environment.setWeather) */
  overcast: number;
  /** rainfall intensity */
  rain: number;
  /** storm light (≥ rain): darkens the sky before a downpour's first drop — the Environment's rain look */
  gloom: number;
  /** smog / PM2.5 density (base haze + spikes, washed out by rain) */
  haze: number;
  /** road wetness: rises within seconds of rain, dries slowly afterwards (CityView wet, tyre grip) */
  wetness: number;
  /** wind strength incl. gusts */
  wind: number;
  /** heading (sim convention, radians) the wind blows TOWARD */
  windDir: number;
  /** brightness of the current lightning flash */
  lightning: number;
}

export const createWeatherState = (kind: WeatherKind): WeatherState => ({
  kind, phase: 'calm', event: null, overcast: 0, rain: 0, gloom: 0, haze: 0, wetness: 0, wind: 0, windDir: 0, lightning: 0,
});

/** an event the timeline is running: the plan entry plus the clock time it started */
export interface ActiveEvent {
  readonly event: WeatherEvent;
  readonly startedAt: number;
}

/** a lightning strike produced by the thunder clock */
export interface Strike {
  /** distance in km (the audio module turns it into a flash-to-sound delay and timbre) */
  km: number;
  /** 0..1 peak flash brightness (near strikes are brighter) */
  power: number;
}
