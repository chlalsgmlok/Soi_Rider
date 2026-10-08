import type { Rng } from '../../core/rng';
import type { BikeModelId } from '../../core/types';
import type { Clock, SfxName, SfxOpts } from '../types';
import { Drivetrain } from './drivetrain';
import { ENGINE_PROFILES } from './engine-profiles';
import { EngineVoice } from './engine-voice';

type EngineState = 'off' | 'starting' | 'running' | 'stopped' | 'stalled';
type PlaySfx = (name: SfxName, opts?: SfxOpts) => void;

/** starter cranking time before the engine catches (s) */
const CRANK = 0.42;
/** rpm flare when it catches */
const CATCH_RPM = 0.38;
const CATCH_SEC = 0.4;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * The rider's own engine. `set(speed01, throttle, load)` every frame — speed01 is road speed / top speed; the
 * per-model drivetrain turns it into rpm (shift dips, CVT hold, rev limiter). Handles model swaps, start
 * (starter crank + catch flare), stop, stall-and-auto-restart after a fall, shift clunks and overrun crackles.
 * The first `set()` after construction starts the engine by itself; after an explicit `stop()` it stays off.
 */
export class EngineControl {
  rpm01 = 0;
  gear = 0;
  private voice: EngineVoice;
  private drive: Drivetrain;
  private model: BikeModelId = 'cub';
  private state: EngineState = 'off';
  private crankEnd = 0;
  private restartAt = Infinity;
  private lastT = -1;
  private speed01 = 0;
  private throttle = 0;
  private load = 0.5;
  private recentThrottle = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly dest: AudioNode,
    private readonly rng: Rng,
    private readonly clock: Clock,
    private readonly sfx: PlaySfx,
  ) {
    this.voice = new EngineVoice(ctx, dest, ENGINE_PROFILES.cub, rng.fork('engine:cub'));
    this.drive = new Drivetrain(ENGINE_PROFILES.cub);
  }

  get running(): boolean {
    return this.state === 'running' || this.state === 'starting';
  }

  get modelId(): BikeModelId {
    return this.model;
  }

  setModel(id: BikeModelId): void {
    if (id === this.model || !ENGINE_PROFILES[id]) return;
    const t = this.clock();
    this.voice.dispose(t);
    this.model = id;
    this.voice = new EngineVoice(this.ctx, this.dest, ENGINE_PROFILES[id], this.rng.fork(`engine:${id}`));
    this.drive = new Drivetrain(ENGINE_PROFILES[id]);
    if (this.running) {
      this.apply(t, 1 / 60);
      this.voice.fade(true, t, 0.25);
    }
  }

  start(): void {
    if (this.running) return;
    const t = this.clock();
    this.state = 'starting';
    this.crankEnd = t + CRANK;
    this.restartAt = Infinity;
    this.drive.reset();
    this.sfx('starter', { intensity: this.model === 'sport' ? 0.8 : 0.55 });
    this.apply(this.crankEnd, 1 / 60);
    this.voice.fade(true, this.crankEnd, 0.05);
  }

  stop(): void {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    this.restartAt = Infinity;
    this.voice.fade(false, this.clock(), 0.6);
  }

  /** engine dies (fall) and restarts itself after `seconds` unless stopped meanwhile */
  stall(seconds: number): void {
    if (!this.running) return;
    const t = this.clock();
    this.state = 'stalled';
    this.restartAt = t + Math.max(0.3, seconds);
    this.voice.apply({ rpm01: 0, throttle: 0, load: 0, speed01: 0, cut: 1 }, t);
    this.voice.fade(false, t, 0.5);
  }

  set(speed01: number, throttle: number, load: number, at?: number): void {
    this.speed01 = Math.min(1.25, Math.max(0, Number.isFinite(speed01) ? speed01 : 0));
    this.throttle = clamp01(throttle);
    this.load = clamp01(load);
    if (this.state === 'off') this.start();
    const t = at ?? this.clock();
    const dt = this.lastT < 0 ? 1 / 60 : t - this.lastT;
    this.lastT = t;
    if (this.running) this.apply(t, dt);
  }

  /** housekeeping from the audio clock (auto-restart after a stall, park a silent voice) */
  tick(now: number): void {
    this.voice.tick(now);
    if (this.state === 'stalled' && now >= this.restartAt) this.start();
  }

  dispose(): void {
    this.voice.dispose(this.clock());
  }

  private apply(t: number, dt: number): void {
    const out = this.drive.update(this.speed01, this.throttle, dt);
    let rpm = out.rpm01;
    if (this.state === 'starting') {
      const since = t - this.crankEnd;
      if (since >= CATCH_SEC) this.state = 'running';
      else rpm = Math.max(rpm, CATCH_RPM * (1 - Math.max(0, since) / CATCH_SEC));
    }
    this.rpm01 = rpm;
    this.gear = out.gear;
    this.voice.apply({ rpm01: rpm, throttle: this.throttle, load: this.load, speed01: this.speed01, cut: out.cut }, t);
    if (out.shifted === 1 && this.model !== 'scooter') this.sfx('shift', { gain: this.model === 'cub' ? 1 : 0.55 });

    // overrun crackle: throttle snapped shut from high revs
    this.recentThrottle = Math.max(this.throttle, this.recentThrottle - Math.max(0, dt) * 3);
    const pops = ENGINE_PROFILES[this.model].pops;
    if (pops > 0 && this.recentThrottle > 0.55 && this.throttle < 0.1 && rpm > 0.45) {
      this.recentThrottle = 0;
      if (this.rng.chance(0.3 + pops * 0.6)) this.sfx('backfire', { intensity: Math.min(1, pops * (0.4 + rpm)) });
    }
  }
}
