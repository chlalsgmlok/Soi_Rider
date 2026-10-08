import type { UiSfx } from '../core/events';
import type { Vec2 } from '../core/types';
import type { AudioGraph } from './audio-graph';
import { AudioSession } from './audio-session';
import type { AudioSink } from './bind/audio-sink';
import { EngineHandle } from './engine/engine-handle';
import type {
  AmbienceLevels, AudioEngineOptions, AudioStats, HornKind, HornPattern, MusicTrack, SfxName, SfxOpts, StingerName, Volumes,
} from './types';
import { unlockOnGesture } from './unlock';

const finite = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

/**
 * The game's sound system. Safe to construct and call before the browser allows audio: every setting (volumes,
 * ambience, music track, listener, engine intent) is remembered and applied when `unlock()` runs inside the first
 * user gesture (`autoUnlock()` installs the listeners). One-shot sounds requested while locked are dropped.
 */
export class AudioEngine implements AudioSink {
  /** the rider's engine: `engine.set(speed / topSpeed, throttle, load)` every frame (see EngineHandle) */
  readonly engine = new EngineHandle();
  private s: AudioSession | null = null;
  private readonly vol: Volumes = { master: 0.9, music: 0.7, sfx: 0.9 };
  private readonly amb: AmbienceLevels = { city: 0, rain: 0, wind: 0, night: 0 };
  private readonly where = { pos: { x: 0, z: 0 }, heading: 0 };
  private readonly rideNow = { speedKmh: 0, wet: 0, skid: 0 };
  private track: MusicTrack | null = null;
  private removeUnlock: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly opts: AudioEngineOptions = {}) {
    Object.assign(this.vol, opts.volumes);
  }

  /** true once the AudioContext is running */
  get unlocked(): boolean {
    return this.s?.running ?? false;
  }

  get context(): AudioContext | null {
    return this.s?.ctx ?? null;
  }

  /** the live sound graph (null until unlocked) — for dev tools */
  get graph(): AudioGraph | null {
    return this.s?.graph ?? null;
  }

  get currentTrack(): MusicTrack | null {
    return this.track;
  }

  /** Create / resume the AudioContext. Call from a user gesture handler. Resolves true when audio runs. */
  unlock(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (!this.s) {
      this.s = AudioSession.create(this.opts.seed ?? 0x50a1, this.opts.pauseWhenHidden ?? true);
      if (!this.s) return Promise.resolve(false);
      this.restore(this.s.graph);
    }
    return this.s.resume();
  }

  /** unlock on the first pointer / key / touch gesture anywhere on `target` (default window); returns a remover */
  autoUnlock(target: EventTarget = window): () => void {
    this.removeUnlock?.();
    const remove = unlockOnGesture(target, () => this.unlocked, () => this.unlock());
    this.removeUnlock = remove;
    return remove;
  }

  /** slider values 0..1 (perceptual taper applied inside) */
  setVolumes(master: number, music: number, sfx: number): void {
    this.vol.master = finite(master, this.vol.master);
    this.vol.music = finite(music, this.vol.music);
    this.vol.sfx = finite(sfx, this.vol.sfx);
    this.graph?.mixer.setVolumes(this.vol.master, this.vol.music, this.vol.sfx);
  }

  /** where the rider's ears are (world position + heading) — positional sounds pan and fade around it */
  setListener(pos: Vec2, heading: number): void {
    this.where.pos.x = finite(pos.x, this.where.pos.x);
    this.where.pos.z = finite(pos.z, this.where.pos.z);
    this.where.heading = finite(heading, this.where.heading);
    const g = this.graph;
    if (!g) return;
    g.listener.pos.x = this.where.pos.x;
    g.listener.pos.z = this.where.pos.z;
    g.listener.heading = this.where.heading;
  }

  /** tyre rumble, helmet wind, wet spray and tyre squeal — every frame: km/h, road wetness 0..1, skid 0..1 */
  ride(speedKmh: number, wet: number, skid: number): void {
    this.rideNow.speedKmh = speedKmh;
    this.rideNow.wet = wet;
    this.rideNow.skid = skid;
    this.graph?.ride.set(speedKmh, wet, skid);
  }

  /** player horn following a held button */
  horn(on: boolean): void {
    this.graph?.horn.set(on);
  }

  /** player horn "meep-meep" (ignored while the held horn sounds) */
  hornTap(): void {
    this.graph?.horn.tap();
  }

  npcHorn(kind: HornKind, pos: Vec2 | null, pattern?: HornPattern, delay = 0): void {
    this.graph?.npcHorn(kind, pos, pattern, delay);
  }

  sfx(name: SfxName, opts?: SfxOpts): void {
    this.graph?.sfx.play(name, opts);
  }

  ui(name: UiSfx, gain = 1): void {
    this.graph?.sfx.ui(name, gain);
  }

  /** set any of the ambience bed levels (0..1), gliding there over `rampSec` */
  ambience(levels: Partial<AmbienceLevels>, rampSec = 2): void {
    Object.assign(this.amb, levels);
    const g = this.graph;
    g?.beds.set(levels, rampSec, g.now());
  }

  /** lightning `distance` away (≤ 50 → km, otherwise metres): delayed crack + rolling rumble */
  thunder(distance: number): void {
    this.graph?.thunder(distance);
  }

  /** crossfade to a looping track (null = fade out) */
  music(track: MusicTrack | null, fadeSec = 1.2): void {
    this.track = track;
    this.graph?.music.play(track, fadeSec);
  }

  stinger(name: StingerName): void {
    this.graph?.music.stinger(name);
  }

  /** lower the music by `amount` 0..1 for `seconds` */
  duck(amount: number, seconds: number): void {
    this.graph?.mixer.duck(amount, seconds);
  }

  /** muffle the world (pause menu, crash daze) 0..1; with `holdSec` it recovers by itself */
  muffle(amount: number, holdSec?: number): void {
    this.graph?.mixer.muffle(amount, undefined, holdSec);
  }

  /** analyser on the final output (null while locked) */
  meter(): AnalyserNode | null {
    return this.s?.meter() ?? null;
  }

  stats(): AudioStats {
    const c = this.context;
    return {
      state: c ? c.state : 'locked',
      time: c ? c.currentTime : 0,
      voices: this.graph?.sfx.voices ?? 0,
      track: this.track,
      rpm01: this.engine.rpm01,
      gear: this.engine.gear,
      sampleRate: c ? c.sampleRate : 0,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeUnlock?.();
    this.engine.attach(null);
    this.s?.dispose();
    this.s = null;
  }

  /** replay everything requested while locked onto the fresh graph */
  private restore(g: AudioGraph): void {
    this.setListener(this.where.pos, this.where.heading);
    g.mixer.setVolumes(this.vol.master, this.vol.music, this.vol.sfx, g.now());
    g.beds.set(this.amb, 1.5, g.now());
    g.ride.set(this.rideNow.speedKmh, this.rideNow.wet, this.rideNow.skid);
    if (this.track) g.music.play(this.track, 1.5);
    this.engine.attach(g.engine);
  }
}
