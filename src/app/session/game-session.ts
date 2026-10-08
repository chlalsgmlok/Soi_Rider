import { BIKES } from '../../core/config/bikes';
import type { CityData, HudState, JobOffer, RunConfig } from '../../core/types';
import type { QualitySettings } from '../../engine';
import { FallRecovery } from './fall-recovery';
import { HudFeed } from './hud-feed';
import { RideAudio } from './ride-audio';
import { RideControl } from './ride-control';
import { RideStack } from './ride-stack';
import { RunWeather } from './run-weather';
import { SessionLoop } from './session-loop';
import { type RunStart, SessionRun } from './session-run';
import type { RunEnd, SessionDeps, SessionMode } from './session-types';
import { SessionWorld } from './session-world';

/** traffic pre-roll around the spawn (s) */
const WARMUP = 12;
/** from the HUD reveal to GO (s of game time) */
const GO_DELAY = 0.45;
/** the closing beat (ARRIVED! / TRIP FAILED callout, farewell) before the receipt (s) */
const END_BEAT: Record<RunEnd, number> = { complete: 2.4, failed: 3 };

/**
 * One run of SOI RIDER from the INTRO to the RESULTS: the city + traffic (SessionWorld), the rider (RideStack), the
 * weather (RunWeather), the accepted job (SessionRun) and who rides (RideControl: player or bot). The app calls
 * `step` at 60 Hz and `frame` once per rendered frame (SessionLoop has the PLAY frame order), then renders and feeds
 * `hud()` to the HUD. `dispose` frees every THREE resource and bus listener of the run.
 */
export class GameSession {
  readonly world: SessionWorld;
  readonly ride: RideStack;
  readonly control: RideControl;
  readonly weather: RunWeather;
  run: SessionRun | null = null;
  job: JobOffer | null = null;
  mode: SessionMode = 'intro';
  /** the pause overlay is up: frames keep drawing, nothing advances or reads the controls */
  paused = false;
  /** after the closing beat of a finished attempt */
  onFinished: ((end: RunEnd) => void) | null = null;
  /** Esc / P / Start while riding */
  onPauseKey: (() => void) | null = null;
  private readonly sound: RideAudio;
  private readonly loop: SessionLoop;
  private readonly hudFeed: HudFeed;
  private readonly recovery: FallRecovery;
  private readonly offQuality: () => void;
  private interactKey = 'E';
  private goIn = -1;
  private endIn = -1;
  private end: RunEnd = 'complete';

  constructor(private readonly deps: SessionDeps, readonly config: RunConfig, data: CityData) {
    const { engine, assets, bus } = deps;
    this.world = new SessionWorld(engine, assets, data, config, bus);
    this.ride = new RideStack(engine, this.world.scene, assets, this.world.query, config.loadout, bus,
      { mode: deps.camera, reducedMotion: deps.reducedMotion });
    const stats = BIKES[config.loadout.bike];
    this.control = new RideControl(deps.input, stats, this.world.query, deps.bot);
    this.sound = new RideAudio(deps.audio, stats, config);
    this.weather = new RunWeather(engine, this.world, this.ride, config, bus);
    this.loop = new SessionLoop(engine, config, this.world, this.ride, this.control, this.sound);
    this.hudFeed = new HudFeed(config.district, this.world.query);
    this.recovery = new FallRecovery(this.world.query, this.world.traffic);
    this.ride.place(data.spawn.pos, data.spawn.heading);
    this.world.traffic.warmup(this.ride.bike.state, WARMUP, config.intensity);
    this.offQuality = engine.onQualityChange((q) => this.setQuality(q));
    bus.on('player:recover', () => this.recover(), this);
  }

  /** game-time scale for the app loop (the fall slow-mo of the event camera) */
  get timeScale(): number {
    return this.mode === 'ride' ? this.ride.cam.timeScale : 1;
  }

  /** the attempt is over and its closing beat is playing (no pausing now) */
  get ending(): boolean {
    return this.endIn > 0;
  }

  /** INTRO frames: the weather (dust motes, haze) lives on; IntroScene.update then advances env, city and traffic */
  introFrame(dt: number): void {
    this.weather.system.update(dt, 0);
  }

  /** the call was accepted and the camera landed: the job starts from the win stand, GO right after the reveal */
  beginRide(job: JobOffer, start: RunStart, interactKey: string): void {
    const { assets, bus } = this.deps;
    this.job = job;
    this.mode = 'ride';
    this.interactKey = interactKey;
    this.ride.place(start.pos, start.heading);
    this.run = new SessionRun({
      world: this.world, ride: this.ride, weather: this.weather.system, assets, bus, interactKey,
      ended: (end) => this.ended(end),
    }, this.config, job, start);
    this.goIn = GO_DELAY;
    this.endIn = -1;
    this.control.reset();
  }

  /** pause › 다시 시작: same call from the win stand — fresh mission, weather and rider; city and traffic carry on */
  restart(): void {
    if (!this.run || !this.job) return;
    const start = this.run.start;
    this.run.dispose();
    this.run = null;
    this.sound.stop();
    this.weather.reset();
    this.ride.rig.setPassenger(null);
    this.ride.carry(null);
    this.beginRide(this.job, start, this.interactKey);
  }

  /** pause › 나가기: the passenger gets off, the call counts as failed (through the normal closing beat) */
  abandon(): void {
    this.run?.mission.abandon();
  }

  /** RESULTS backdrop: the rider parked, the camera orbiting slowly, the city still alive */
  outro(): void {
    this.mode = 'outro';
    this.goIn = -1;
    this.endIn = -1;
    this.sound.stop();
    this.control.reset();
    this.loop.resetOutro();
  }

  step(dt: number): void {
    const run = this.run;
    if (!run || this.mode === 'intro') return;
    if (this.goIn > 0 && (this.goIn -= dt) <= 0) {
      run.mission.start(run.start);
      const w = this.weather.system.state;
      this.sound.start(w.kind, w.rain);
    }
    this.loop.step(dt, run, this.weather, this.mode === 'outro');
  }

  frame(frameDt: number): void {
    const run = this.run;
    if (!run || this.mode === 'intro') return;
    if (!this.paused && this.mode === 'ride') this.readControls();
    this.loop.frame(this.paused ? 0 : frameDt, run, this.weather, this.mode === 'outro');
    if (this.endIn > 0 && !this.paused && (this.endIn -= frameDt) <= 0) this.onFinished?.(this.end);
  }

  /** PLAY step 9 (null outside the ride) */
  hud(width: number, height: number): HudState | null {
    if (!this.run || this.mode !== 'ride') return null;
    return this.hudFeed.build(this.run, this.ride, this.weather.system, this.deps.engine.camera, width, height);
  }

  /** QA hook (window.__game.debug.failComfort): the passenger's comfort drops to 0 → the run fails on the next step */
  failComfort(): boolean {
    const m = this.run?.mission;
    if (!m || !m.flow.live) return false;
    m.comfort.value = 0;
    m.comfort.failed = true;
    return true;
  }

  dispose(): void {
    this.deps.bus.offAllOwnedBy(this);
    this.offQuality();
    this.sound.stop();
    this.run?.dispose();
    this.run = null;
    this.weather.dispose();
    this.ride.dispose();
    this.world.dispose();
  }

  private readControls(): void {
    const pi = this.control.poll();
    if (pi.cameraPressed) this.ride.cycleCamera();
    if (pi.hornPressed) this.ride.horn();
    if (pi.pausePressed && this.endIn < 0) this.onPauseKey?.();
  }

  private ended(end: RunEnd): void {
    this.end = end;
    this.endIn = END_BEAT[end];
  }

  private recover(): void {
    const spot = this.recovery.find(this.ride.bike.state.pos);
    if (spot) this.ride.place(spot.pos, spot.heading);
  }

  private setQuality(q: QualitySettings): void {
    this.world.env.setQuality(q);
    this.ride.setQuality(q);
    this.weather.setQuality(q);
  }
}
