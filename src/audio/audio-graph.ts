import { Rng } from '../core/rng';
import type { Vec2 } from '../core/types';
import { AmbienceBeds } from './ambience/ambience-beds';
import { CityLife } from './ambience/city-life';
import { thunderDef, thunderDelay, thunderKm } from './ambience/thunder';
import type { Listener } from './core/spatial';
import { EngineControl } from './engine/engine-control';
import { RideNoise } from './engine/ride-noise';
import { HORN_PATTERNS, HORN_SPECS, TUKTUK_PIPS } from './horns/horn-specs';
import { playHornBlasts } from './horns/horn-tone';
import { PlayerHorn } from './horns/player-horn';
import { Mixer, type MixerOptions } from './mixer';
import { MusicPlayer } from './music/music-player';
import { def } from './sfx/sfx-def';
import { SfxPlayer } from './sfx/sfx-player';
import type { Clock, HornKind, HornPattern, SfxName, SfxOpts } from './types';

const DEFAULT_PATTERNS: readonly HornPattern[] = ['tap', 'tap', 'double', 'long'];

/**
 * The whole sound world on one BaseAudioContext — realtime or offline. Everything schedules against `now()`,
 * which is the context clock unless `simTime` is set (offline renders drive time by hand).
 */
export class AudioGraph {
  readonly mixer: Mixer;
  readonly listener: Listener = { pos: { x: 0, z: 0 }, heading: 0 };
  readonly sfx: SfxPlayer;
  readonly engine: EngineControl;
  readonly ride: RideNoise;
  readonly horn: PlayerHorn;
  readonly beds: AmbienceBeds;
  readonly life: CityLife;
  readonly music: MusicPlayer;
  /** set to drive the clock by hand (offline rendering); null = context clock */
  simTime: number | null = null;
  readonly now: Clock = () => this.simTime ?? this.ctx.currentTime;
  private readonly rng: Rng;

  constructor(readonly ctx: BaseAudioContext, seed: number, opts: MixerOptions = {}) {
    const rng = new Rng(seed);
    this.rng = rng.fork('graph');
    this.mixer = new Mixer(ctx, rng.fork('mixer'), opts);
    this.sfx = new SfxPlayer(ctx, this.mixer, rng.fork('sfx'), this.listener, this.now);
    const play = (name: SfxName, o: SfxOpts = {}): void => this.sfx.play(name, o);
    this.engine = new EngineControl(ctx, this.mixer.world, rng.fork('engine'), this.now, play);
    this.ride = new RideNoise(ctx, this.mixer.world, rng.fork('ride'));
    this.horn = new PlayerHorn(ctx, this.mixer.world, rng.fork('horn'), this.now);
    this.beds = new AmbienceBeds(ctx, this.mixer.world, rng.fork('beds'));
    this.life = new CityLife(rng.fork('life'), this.listener, {
      sfx: play,
      npcHorn: (kind, pos, pattern) => this.npcHorn(kind, pos, pattern),
    });
    this.music = new MusicPlayer(ctx, this.mixer.music, this.mixer.sting, rng.fork('music'), this.now, (a, s) =>
      this.mixer.duck(a, s, this.now()),
    );
  }

  /** an NPC vehicle's horn at `pos` (null = right next to the rider) */
  npcHorn(kind: HornKind, pos: Vec2 | null, pattern?: HornPattern, delay = 0): void {
    const spec = HORN_SPECS[kind] ?? HORN_SPECS.sedan;
    const blasts = kind === 'tuktuk' ? this.rng.pick(TUKTUK_PIPS) : HORN_PATTERNS[pattern ?? this.rng.pick(DEFAULT_PATTERNS)];
    const pitch = 0.97 + this.rng.next() * 0.06;
    const opts: SfxOpts = { delay };
    if (pos) opts.pos = pos;
    this.sfx.custom(`horn:${kind}`, def((v, t) => playHornBlasts(v, spec, t, blasts, pitch), 0.12, 0.18), opts);
  }

  /** thunder `distance` away (≤ 50 → km, > 50 → metres); arrives after a flash-to-sound delay */
  thunder(distance: number): void {
    const km = thunderKm(distance);
    const delay = thunderDelay(km);
    this.sfx.custom('thunder', thunderDef(km), { delay, pan: this.rng.next() * 1.2 - 0.6 });
    this.mixer.duck(0.25, delay + 3, this.now());
  }

  /** housekeeping on the audio clock: music look-ahead, stall restarts, traffic swells, city life, parking silent branches */
  tick(now: number): void {
    this.music.tick(now);
    this.engine.tick(now);
    this.ride.tick(now);
    this.horn.tick(now);
    this.beds.drift(now);
    this.life.tick(now, this.beds.levels);
    this.mixer.tick(now, this.sfx.voices > 0);
  }

  dispose(): void {
    this.music.dispose();
    this.engine.dispose();
    this.ride.dispose();
    this.horn.dispose();
    this.beds.dispose();
    this.mixer.dispose();
  }
}
