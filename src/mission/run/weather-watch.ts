import type { MissionWeather } from './mission-types';

/** rain level that counts as a downpour when the weather gives no explicit flag (on / off hysteresis) */
export const RAIN_ON = 0.3;
export const RAIN_OFF = 0.12;
/** smog this far above the day's base haze counts as a spike (on / off) */
export const SPIKE_ON = 0.18;
export const SPIKE_OFF = 0.08;

export interface WeatherStarts {
  downpour: boolean;
  haze: boolean;
}

/**
 * Reads the live weather into two latched states — raining (downpour) and smoggy (haze spike) — and reports when
 * each starts (story prompts, passenger remarks). Explicit flags from src/weather win over the level thresholds.
 */
export class WeatherWatch {
  raining = false;
  smoggy = false;
  private readonly starts: WeatherStarts = { downpour: false, haze: false };

  constructor(private readonly baseHaze = 0) {}

  update(w: MissionWeather): Readonly<WeatherStarts> {
    const wasRaining = this.raining;
    const wasSmoggy = this.smoggy;
    this.raining = w.downpour ?? (this.raining ? w.rain > RAIN_OFF : w.rain >= RAIN_ON);
    const excess = w.haze - this.baseHaze;
    this.smoggy = w.hazeSpike ?? (this.smoggy ? excess > SPIKE_OFF : excess >= SPIKE_ON);
    this.starts.downpour = this.raining && !wasRaining;
    this.starts.haze = this.smoggy && !wasSmoggy;
    return this.starts;
  }
}
