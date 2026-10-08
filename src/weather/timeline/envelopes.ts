import { clamp, smoothstep } from '../../core/math2d';
import type { WeatherEvent } from '../../core/types';
import type { WeatherPhase } from '../types';

/**
 * Shape of a downpour in seconds (docs/GAME_DESIGN.md §7): a 6 s build-up (sky darkens, gust front, first fat
 * drops, thunder) → full rain → taper → after-rain (clouds lift while the roads dry).
 */
export const DOWNPOUR_SHAPE = {
  buildup: 6,
  /** the cloud deck is fully closed (and the light stormy) this long after the start */
  darken: 4.5,
  /** cloud deck of a downpour (the storm light below does the darkening) */
  deck: 0.8,
  /** first scattered fat drops */
  firstDrops: 2.2,
  /** the heavy rain sets in here … */
  heavyFrom: 4.6,
  /** … and is at full strength here (just after the build-up) */
  fullAt: 7,
  /** taper length = share × duration, clamped */
  taperShare: 0.22,
  taperMin: 10,
  taperMax: 24,
  /** after the last drop the clouds lift back to the base deck over this long */
  lift: 25,
} as const;

/** smog spike ramps (seconds), shortened for very short spikes */
export const HAZE_SHAPE = { rise: 6, fall: 10 } as const;

export interface DownpourLevels {
  overcast: number;
  rain: number;
  /** storm light: the sky goes dark slate before the first drop and brightens as the rain eases */
  gloom: number;
  wind: number;
  phase: WeatherPhase;
}

export const createDownpourLevels = (): DownpourLevels => ({ overcast: 0, rain: 0, gloom: 0, wind: 0, phase: 'calm' });

/** effective downpour length: long enough for build-up + full rain + a taper */
export const downpourSec = (ev: WeatherEvent): number =>
  Math.max(ev.duration, DOWNPOUR_SHAPE.fullAt + DOWNPOUR_SHAPE.taperMin);

export const taperSec = (durationSec: number): number =>
  clamp(durationSec * DOWNPOUR_SHAPE.taperShare, DOWNPOUR_SHAPE.taperMin, DOWNPOUR_SHAPE.taperMax);

/** seconds an event keeps influencing the weather after it started (downpour incl. the cloud lift) */
export const eventSpan = (ev: WeatherEvent): number =>
  ev.kind === 'downpour' ? downpourSec(ev) + DOWNPOUR_SHAPE.lift : Math.max(ev.duration, 1);

/** levels `t` seconds after a downpour started (pure). Overcast/wind are the event's own contribution. */
export function downpourAt(t: number, ev: WeatherEvent, out: DownpourLevels): DownpourLevels {
  const S = DOWNPOUR_SHAPE;
  const D = downpourSec(ev);
  const I = clamp(ev.intensity, 0, 1);
  const taperStart = D - taperSec(D);
  if (t < 0 || t >= D + S.lift) {
    out.overcast = out.rain = out.gloom = out.wind = 0;
    out.phase = 'calm';
    return out;
  }
  out.phase = t < S.buildup ? 'buildup' : t < taperStart ? 'downpour' : t < D ? 'taper' : 'after';

  // the deck closes fast, holds while it rains, then lifts
  out.overcast = S.deck * (t < D ? smoothstep(0, S.darken, t) : 1 - smoothstep(D, D + S.lift, t));
  out.gloom = (0.72 + 0.28 * I) * smoothstep(0, S.darken, t) * (1 - smoothstep(taperStart, D + 8, t));

  // a few fat drops, then the heavy rain; the taper leaves a short drizzle tail
  const drizzle = 0.08 * smoothstep(S.firstDrops, S.firstDrops + 1.6, t);
  const heavy = I * smoothstep(S.heavyFrom, S.fullAt, t);
  const ease = 1 - smoothstep(taperStart, D, t);
  out.rain = t < D ? Math.max(drizzle, heavy) * ease * Math.sqrt(ease) : 0;

  // the gust front arrives before the rain, then a steady blow that dies with the taper
  const front = 0.95 * smoothstep(0.4, 3.2, t) * (1 - smoothstep(6, 10, t));
  const steady = (0.42 + 0.3 * I) * smoothstep(3, 6, t) * (1 - smoothstep(taperStart, D + 8, t));
  out.wind = Math.max(front, steady);
  return out;
}

/** smog spike strength 0..1 `t` seconds after it started (pure) */
export function hazeSpikeAt(t: number, ev: WeatherEvent): number {
  const D = Math.max(ev.duration, 1);
  if (t <= 0 || t >= D) return 0;
  const rise = Math.min(HAZE_SHAPE.rise, D / 3);
  const fall = Math.min(HAZE_SHAPE.fall, D / 2.5);
  return clamp(ev.intensity, 0, 1) * smoothstep(0, rise, t) * (1 - smoothstep(D - fall, D, t));
}

/** storminess 0..1 for the thunder clock: heavy downpours rumble more, the taper only now and then */
export function thunderActivity(phase: WeatherPhase, intensity: number): number {
  const storm = 0.35 + 0.65 * clamp((intensity - 0.7) / 0.3, 0, 1);
  if (phase === 'buildup' || phase === 'downpour') return storm;
  return phase === 'taper' ? storm * 0.4 : 0;
}
