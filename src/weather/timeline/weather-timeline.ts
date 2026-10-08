import { clamp } from '../../core/math2d';
import type { EventBus } from '../../core/events';
import type { Rng } from '../../core/rng';
import type { WeatherEvent, WeatherKind, WeatherPlan } from '../../core/types';
import { type ActiveEvent, createWeatherState, type Strike, type WeatherState } from '../types';
import { createDownpourLevels, downpourAt, eventSpan, hazeSpikeAt, thunderActivity } from './envelopes';
import { Gusts } from './gusts';
import { stepWashout, stepWetness } from './rain-aftermath';
import { ThunderClock } from './thunder-clock';

/** cloud deck and wind of each base weather */
export const BASE_LEVELS: Readonly<Record<WeatherPlan['base'], { overcast: number; wind: number }>> = {
  clear: { overcast: 0, wind: 0.14 },
  haze: { overcast: 0.12, wind: 0.06 },
  overcast: { overcast: 0.78, wind: 0.3 },
};
/** a full smog spike pushes the haze this far */
export const SPIKE_HAZE = 0.92;
/** rain scrubs up to this share of the smog out of the air */
export const WASHOUT = 0.6;

/**
 * The run's weather as a pure timeline (no three.js): plan events start when the trip progress reaches their
 * `atProgress` (or on `trigger`), run on the clock for their duration, and their envelopes combine into the
 * WeatherState. Emits 'weather:change' when the headline kind changes (rain from the first build-up second until
 * the taper ends; haze for a smog spike — `from` may equal `to` when a spike hits an already hazy day) and
 * 'thunder' for every strike.
 */
export class WeatherTimeline {
  readonly state: WeatherState;
  /** lightning strikes so far (presentation aims each new flash) */
  strikes = 0;
  private readonly pending: WeatherEvent[];
  private readonly active: ActiveEvent[] = [];
  private readonly gusts: Gusts;
  private readonly thunder: ThunderClock;
  private readonly lv = createDownpourLevels();
  private clock = 0;
  private wash = 0;
  /** true until a smog phase begins (a spike on an already hazy day still announces itself) */
  private smogWasOff = true;

  constructor(private readonly plan: WeatherPlan, rng: Rng, private readonly bus: EventBus) {
    this.pending = [...plan.events].sort((a, b) => a.atProgress - b.atProgress);
    this.gusts = new Gusts(rng.fork('gusts'));
    this.thunder = new ThunderClock(rng.fork('thunder'));
    this.state = createWeatherState(plan.base);
    this.compose(0, 1);
  }

  /** seconds since the timeline started */
  get time(): number {
    return this.clock;
  }

  /** events still waiting for their trip progress */
  get upcoming(): readonly WeatherEvent[] {
    return this.pending;
  }

  /** start an event now, whatever the trip progress (debug keys, sandboxes). Ignored while one of its kind runs. */
  trigger(kind: WeatherEvent['kind'], duration: number, intensity: number): boolean {
    const running = this.active.some((a) => a.event.kind === kind && this.clock - a.startedAt < a.event.duration);
    if (running) return false;
    this.start({ kind, atProgress: -1, duration: Math.max(1, duration), intensity: clamp(intensity, 0, 1) });
    return true;
  }

  /** force a lightning strike now (debug) */
  strike(km?: number): Strike {
    const s = this.thunder.strike(km);
    this.strikes++;
    this.bus.emit('thunder', { distance: s.km });
    return s;
  }

  /** advance by dt; `progress` = trip progress 0..1, `daylight` 0..1 (drying power of the sun) */
  update(dt: number, progress: number, daylight = 1): void {
    this.clock += dt;
    while (this.pending.length > 0 && progress >= this.pending[0].atProgress) {
      const ev = this.pending.shift();
      if (ev) this.start(ev);
    }
    this.compose(dt, daylight);
  }

  private start(event: WeatherEvent): void {
    this.active.push({ event, startedAt: this.clock });
    if (event.kind === 'downpour') this.thunder.arm();
  }

  private compose(dt: number, daylight: number): void {
    const s = this.state;
    const base = BASE_LEVELS[this.plan.base];
    let overcast = base.overcast;
    let wind = base.wind;
    let rain = 0;
    let gloom = 0;
    let spike = 0;
    let rainPhase: WeatherState['phase'] | null = null;
    let after = false;
    let storm = 0;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      const t = this.clock - a.startedAt;
      if (t >= eventSpan(a.event)) {
        this.active.splice(i, 1);
        continue;
      }
      if (a.event.kind === 'haze_spike') {
        spike = Math.max(spike, hazeSpikeAt(t, a.event));
        continue;
      }
      const lv = downpourAt(t, a.event, this.lv);
      overcast = Math.max(overcast, lv.overcast);
      wind = Math.max(wind, lv.wind);
      rain = Math.max(rain, lv.rain);
      gloom = Math.max(gloom, lv.gloom);
      if (lv.phase === 'after') after = true;
      else if (lv.phase !== 'calm') {
        rainPhase = lv.phase;
        storm = Math.max(storm, thunderActivity(lv.phase, a.event.intensity));
      }
    }
    this.wash = stepWashout(this.wash, rain, dt);
    const sun = clamp(daylight, 0, 1) * (1 - 0.6 * overcast);
    s.wetness = stepWetness(s.wetness, rain, sun, dt);
    s.overcast = clamp(overcast, 0, 1);
    s.rain = clamp(rain, 0, 1);
    s.gloom = clamp(Math.max(rain, gloom), 0, 1);
    const haze = this.plan.haze + (SPIKE_HAZE - this.plan.haze) * spike;
    s.haze = clamp(haze * (1 - WASHOUT * this.wash), 0, 1);
    s.wind = clamp(wind * (0.78 + 0.44 * this.gusts.at(this.clock)), 0, 1);
    s.windDir = this.gusts.heading(this.clock);
    const strike = this.thunder.update(dt, storm);
    if (strike) {
      this.strikes++;
      this.bus.emit('thunder', { distance: strike.km });
    }
    s.lightning = this.thunder.flash;

    const prev = s.kind;
    if (rainPhase) this.setPhase(rainPhase, 'downpour', 'rain');
    else if (spike > 0) this.setPhase('smog', 'haze_spike', 'haze');
    else if (after) this.setPhase('after', 'downpour', this.plan.base);
    else this.setPhase('calm', null, this.plan.base);
    const spikeStarted = s.kind === 'haze' && s.phase === 'smog' && this.smogWasOff;
    this.smogWasOff = s.phase !== 'smog';
    if (s.kind !== prev || spikeStarted) this.emitChange(prev, s.kind);
  }

  private setPhase(phase: WeatherState['phase'], event: WeatherState['event'], kind: WeatherKind): void {
    this.state.phase = phase;
    this.state.event = event;
    this.state.kind = kind;
  }

  private emitChange(from: WeatherKind, to: WeatherKind): void {
    const rain = to === 'rain' ? this.rainTarget() : this.state.rain;
    this.bus.emit('weather:change', { from, to, rain });
  }

  /** the rain level the running downpour is heading for (audio ramps its bed there) */
  private rainTarget(): number {
    const d = this.active.find((a) => a.event.kind === 'downpour');
    return d ? clamp(d.event.intensity, 0, 1) : this.state.rain;
  }
}
