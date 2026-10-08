import { INTENSITY } from '../../core/config/traffic';
import { Rng } from '../../core/rng';
import {
  Surface, type JobOffer, type MissionPhase, type PassengerProfile, type PlayerState, type POI, type PromptState,
  type RunConfig, type RunResult, type RunStats, type Vec2,
} from '../../core/types';
import { ComfortModel } from '../../logic/comfort';
import { seatPerkOf, startingComfort } from '../../logic/comfort-tuning';
import type { Situation } from '../../logic/dialogue-lines';
import { createRunStats, finalizeStats, tickRunStats } from '../../logic/run-stats';
import { etaSeconds } from '../../logic/run-setup';
import { computeResult } from '../../logic/scoring';
import { StyleTracker } from '../../logic/style';
import { Navigator } from '../nav/navigator';
import { AmbientTalk, type TalkInput } from './ambient-talk';
import { IncidentFeed } from './incident-feed';
import { type MissionHud, MissionHudBuilder } from './mission-hud';
import type { MissionFrame, MissionHooks, MissionOptions, MissionView } from './mission-types';
import { PassengerVoice } from './passenger-voice';
import { advancePhase, checkFail } from './phase-director';
import { PhaseFlow } from './phase-flow';
import { RideCare } from './ride-care';
import { RoadEvents } from './road-events';

const poiOf = (pois: readonly POI[], id: number): POI => {
  const p = pois.find((q) => q.id === id);
  if (!p) throw new Error(`[mission] job references missing POI ${id}`);
  return p;
};

/**
 * One gram job from GO to the receipt (docs/GAME_DESIGN.md §8–§10): phases, navigation, the passenger (comfort, care
 * prompts, chatter), safety / style bookkeeping, fail rules and the RunResult. Feed it once per fixed step after
 * physics + traffic (`update`), read `hud()` every frame and wire `hooks` for the boarding / drop-off moments.
 */
export class MissionController implements MissionView {
  readonly config: RunConfig;
  readonly job: JobOffer;
  readonly nav: Navigator;
  readonly stats: RunStats;
  readonly comfort: ComfortModel;
  readonly style = new StyleTracker();
  readonly flow = new PhaseFlow();
  readonly care: RideCare;
  readonly road: RoadEvents;
  readonly pickup: POI;
  readonly drop: POI;
  readonly passenger: PassengerProfile;
  /** both legs measured on the road graph at construction (m); ETA = their sum at INTENSITY.etaSpeed */
  readonly approachMeters: number;
  readonly tripMeters: number;
  readonly pose = { pos: { x: 0, z: 0 } as Vec2, heading: 0, speed: 0 };
  readonly bus: MissionOptions['bus'];
  readonly hooks: MissionHooks;
  private readonly voice: PassengerVoice;
  private readonly talk = new AmbientTalk();
  private readonly incidents = new IncidentFeed();
  private readonly hudBuilder = new MissionHudBuilder();
  private readonly talkIn: TalkInput = {
    aboard: false, waiting: false, approachLate: false, speed: 0, counterflow: false, sidewalk: false, late: false,
    hurried: false, hot: false, smog: false, calmFor: 0,
  };
  private now = 0;
  private calmFor = 0;
  private progress = 0;

  constructor(o: MissionOptions) {
    const { city, job, config } = o;
    this.config = config;
    this.job = job;
    this.bus = o.bus;
    this.hooks = o.hooks ?? {};
    this.pickup = poiOf(city.data.pois, job.pickupPoi);
    this.drop = poiOf(city.data.pois, job.dropPoi);
    this.passenger = job.passenger;
    const start = o.start ?? city.data.spawn;
    this.pose.pos = { x: start.pos.x, z: start.pos.z };
    this.pose.heading = start.heading;
    this.nav = new Navigator(city.data);
    this.approachMeters = this.nav.plan(start, this.pickup)?.length ?? job.approachMeters;
    this.tripMeters = this.nav.plan({ pos: this.pickup.pos, heading: this.pickup.heading }, this.drop)?.length ?? job.estMeters;
    const eta = etaSeconds(this.approachMeters + this.tripMeters, config.intensity);
    this.stats = createRunStats(eta, Math.round(this.tripMeters), startingComfort(config.loadout.helmet, config.loadout.gear));
    this.comfort = new ComfortModel(job.passenger.trait, this.stats.finalComfort, seatPerkOf(config.loadout.gear));
    this.voice = new PassengerVoice((o.rng ?? new Rng(config.seed).fork('mission')).fork('voice'), job.passenger, o.bus);
    this.care = new RideCare(city, config, o.interactKey ?? 'E');
    this.road = new RoadEvents(city.data, job.passenger.trait, this.drop, this.pickup);
    this.talkIn.hurried = job.passenger.trait === 'hurry';
  }

  get phase(): MissionPhase {
    return this.flow.phase;
  }

  /** the passenger is riding along */
  get aboard(): boolean {
    return this.flow.aboard;
  }

  get arriving(): boolean {
    return this.flow.phase === 'arriving';
  }

  /** boarding / drop-off moment playing: hold the bike still */
  get holdBike(): boolean {
    return this.flow.scripted;
  }

  get targetPos(): Vec2 | null {
    const ph = this.flow.phase;
    if (ph === 'complete' || ph === 'failed') return null;
    return ph === 'toDropoff' || ph === 'arriving' ? this.drop.pos : this.pickup.pos;
  }

  get prompt(): PromptState | null {
    return this.care.prompts.active;
  }

  /** 0..1 along the pickup → drop leg, never decreasing (WeatherSystem.update reads it) */
  get tripProgress(): number {
    return this.progress;
  }

  /** GO: intro → toPickup, routing from the rider's pose */
  start(from?: { pos: Vec2; heading: number }): void {
    if (from) {
      this.pose.pos = { x: from.pos.x, z: from.pos.z };
      this.pose.heading = from.heading;
    }
    if (!this.flow.start()) return;
    this.nav.setTarget(this.pickup, this.pose);
    this.bus.emit('mission:phase', { phase: 'toPickup', prev: 'intro' });
  }

  update(dt: number, f: MissionFrame): void {
    if (!this.flow.live || !(dt > 0)) return;
    const p = f.player;
    this.now += dt;
    this.calmFor += dt;
    Object.assign(this.pose.pos, p.pos);
    this.pose.heading = p.heading;
    this.pose.speed = p.speed;
    tickRunStats(this.stats, dt, { counterflow: p.counterflow, sidewalk: p.surface === Surface.Sidewalk });
    this.nav.update(dt, this.pose);
    if (this.aboard) this.progress = Math.max(this.progress, Math.min(1, 1 - this.nav.remaining / Math.max(1, this.tripMeters)));
    this.incidents.step(dt, f, this);
    this.care.step(dt, f, this);
    this.road.step(dt, f, this);
    this.talk.update(dt, this.now, this.talkInput(p), this.voice);
    advancePhase(this, dt, p);
    if (this.flow.live) checkFail(this);
  }

  /** the player quit the job (pause menu) */
  abandon(): void {
    if (!this.flow.live) return;
    this.stats.failed = 'abandon';
    checkFail(this);
  }

  /** the mission's part of HudState (same object every call) */
  hud(): MissionHud {
    return this.hudBuilder.build(this);
  }

  /** the counters settled for logic.settleRun (style synced, final comfort, fail reason) */
  finalStats(): RunStats {
    return finalizeStats(this.stats, this.comfort, this.style);
  }

  /** the receipt (once complete / failed); `prevBest` = the save's bestScore before payout */
  result(prevBest?: number): RunResult {
    return computeResult(this.config, this.job, this.finalStats(), prevBest);
  }

  /** passenger speech through the cooldown gate */
  say(situation: Situation, place?: string): void {
    this.voice.say(situation, this.now, place);
  }

  /** a comfort loss happened (resets the calm clock behind 'smooth' remarks) */
  upset(): void {
    this.calmFor = 0;
  }

  private talkInput(p: PlayerState): TalkInput {
    const t = this.talkIn;
    t.aboard = this.aboard;
    t.waiting = this.flow.phase === 'toPickup';
    t.approachLate = this.stats.timeSec > (this.approachMeters / INTENSITY[this.config.intensity].etaSpeed) * 0.8 + 10;
    t.speed = p.speed;
    t.counterflow = p.counterflow;
    t.sidewalk = p.surface === Surface.Sidewalk;
    t.late = this.stats.timeSec > this.stats.etaSec;
    t.hot = this.care.hot;
    t.smog = this.care.smog;
    t.calmFor = this.calmFor;
    return t;
  }
}
