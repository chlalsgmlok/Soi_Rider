import type { EventBus } from '../../core/events';
import { Surface, type CityQuery, type RunConfig, type RunStats, type TrafficAgentView } from '../../core/types';
import type { ComfortModel } from '../../logic/comfort';
import type { Situation } from '../../logic/dialogue-lines';
import { recordCare } from '../../logic/run-stats';
import { behindExhaust } from './exhaust-check';
import type { MissionFrame, MissionHooks } from './mission-types';
import { STOP_SPEED } from './phase-flow';
import { type CareId, StoryPrompts } from './story-prompts';
import { WeatherWatch } from './weather-watch';

/** what the care layer drives */
export interface CareSink {
  readonly stats: RunStats;
  readonly comfort: ComfortModel;
  readonly bus: EventBus;
  readonly hooks: MissionHooks;
  readonly aboard: boolean;
  say(situation: Situation): void;
  upset(): void;
}

/** "stop first" nudges no more often than this (s) */
const NUDGE_GAP = 2.5;

/**
 * The passenger's well-being on board (docs/GAME_DESIGN.md §7–§8): weather onsets → raincoat / mask story prompts,
 * continuous comfort (harsh braking, sharp turns, counterflow, sidewalk, rain without poncho, smog without mask —
 * haze spikes and bus exhaust —, midday heat stopped in the sun via CityQuery.shadedAt), all onto the bus.
 */
export class RideCare {
  readonly weather: WeatherWatch;
  readonly prompts: StoryPrompts;
  readonly given = { poncho: false, mask: false };
  /** live conditions (ambient chatter reads them) */
  hot = false;
  smog = false;
  private readonly heatDay: boolean;
  private readonly scratch: TrafficAgentView[] = [];
  private sinceNudge = Infinity;

  constructor(private readonly city: CityQuery, config: RunConfig, interactKey: string) {
    this.weather = new WeatherWatch(config.weather.haze);
    this.prompts = new StoryPrompts(interactKey);
    this.heatDay = config.timeOfDay === 'noon' && config.weather.base === 'clear';
  }

  step(dt: number, f: MissionFrame, sink: CareSink): void {
    const p = f.player;
    const starts = this.weather.update(f.weather);
    if (sink.aboard && starts.downpour) sink.say('rainStart');
    this.sinceNudge += dt;
    const stopped = Math.abs(p.speed) < STOP_SPEED;
    const input = { aboard: sink.aboard, stopped, interact: f.interact, raining: this.weather.raining, smoggy: this.weather.smoggy };
    for (const e of this.prompts.update(dt, input)) {
      if (e.kind === 'open') sink.bus.emit('story:prompt', e.prompt);
      else if (e.kind === 'resolve') this.resolve(e.id, e.success, sink);
      else if (this.sinceNudge > NUDGE_GAP) {
        this.sinceNudge = 0;
        sink.bus.emit('toast', { text: '먼저 멈춰야 건넬 수 있어요', tone: 'warn', icon: 'warning' });
      }
    }

    const exhaust = f.traffic !== null && behindExhaust(p.pos, p.heading, f.traffic, this.scratch);
    this.smog = sink.aboard && !this.given.mask && (this.weather.smoggy || exhaust);
    this.hot = this.heatDay && f.weather.rain < 0.1 && Math.abs(p.speed) < 1 && !this.city.shadedAt(p.pos);
    if (!sink.aboard) return;
    const deltas = sink.comfort.tick(dt, {
      speed: p.speed,
      accel: p.accel,
      lateralAccel: Math.abs(p.speed * p.yawRate),
      counterflow: p.counterflow,
      sidewalk: p.surface === Surface.Sidewalk,
      rainingNoPoncho: this.weather.raining && !this.given.poncho,
      smogNoMask: this.smog,
      heatStoppedUnshaded: this.hot,
    });
    for (const d of deltas) {
      sink.bus.emit('comfort:delta', { delta: d.delta, reason: d.reason, value: d.value });
      if (d.cause === 'harshBrake') sink.say('harshBrake');
      if (d.delta < 0) sink.upset();
    }
  }

  private resolve(id: CareId, success: boolean, sink: CareSink): void {
    recordCare(sink.stats, id, success ? 'given' : 'missed');
    sink.bus.emit('story:resolve', { id, success });
    if (!success) {
      sink.say(id === 'raincoat' ? 'raincoatMissed' : 'haze');
      return;
    }
    if (id === 'raincoat') this.given.poncho = true;
    else this.given.mask = true;
    sink.hooks.care?.(this.given.poncho, this.given.mask);
    const d = sink.comfort.event(id);
    if (d) sink.bus.emit('comfort:delta', { delta: d.delta, reason: d.reason, value: d.value });
    sink.say(id === 'raincoat' ? 'raincoatGiven' : 'maskGiven');
  }
}
