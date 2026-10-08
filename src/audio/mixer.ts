import type { Rng } from '../core/rng';
import { safetyClip } from './core/curves';
import { chase, retarget } from './core/envelope';
import { streetImpulse } from './core/impulse';
import { Valve } from './core/valve';

const MUFFLE_MIN_HZ = 380;
const OPEN_HZ = 20000;
/** street reverb length (s) — a narrow soi rings briefly; longer IRs cost a lot of convolution CPU */
const REVERB_SEC = 1.1;

/** slider 0..1 → gain with a perceptual (squared) taper */
const taper = (v: number): number => {
  const c = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  return c * c;
};

export interface MixerOptions {
  /** glue compressor + soft safety clip on the master (default true; off only for raw-level analysis) */
  limiter?: boolean;
}

/**
 * Bus layout
 *   world  (engine · sfx · horns · ambience) ─┬─ muffle LPF ─ worldVol(sfx) ─┐
 *   reverb send ─ street convolver ─ return ──┘                              │
 *   ui ─ uiVol(sfx) ─────────────────────────────────────────────────────────┼─ glue comp ─ master ─ soft clip ─ out
 *   music ─ duck ─ musicVol ─────────────────────────────────────────────────┘
 * UI stays crisp while the world is muffled (pause menu, crash daze); music ducks under prompts and stingers.
 * The convolver is only connected while one-shots are sounding (`wakeReverb` / `tick`) — it is the most
 * expensive node in the graph.
 */
export class Mixer {
  readonly world: GainNode;
  readonly reverb: GainNode;
  readonly ui: GainNode;
  readonly music: GainNode;
  /** music input after the duck (stingers ride over a ducked bed) */
  readonly sting: GainNode;
  /** final stage — tap it for meters / analysers */
  readonly output: AudioNode;
  private readonly muffleFilter: BiquadFilterNode;
  private readonly worldVol: GainNode;
  private readonly uiVol: GainNode;
  private readonly musicVol: GainNode;
  private readonly duckGain: GainNode;
  private readonly master: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly reverbValve: Valve;
  private duckUntil = 0;
  private duckDepth = 0;

  constructor(private readonly ctx: BaseAudioContext, rng: Rng, opts: MixerOptions = {}) {
    const limiter = opts.limiter ?? true;
    const sum = this.gain(1);
    this.master = this.gain(0.85);
    if (limiter) {
      const glue = this.comp(-16, 8, 2.5, 0.012, 0.25);
      // the soft clip is transparent below −4.4 dBFS and only rounds rare peaks, so no oversampling needed
      const clip = ctx.createWaveShaper();
      clip.curve = safetyClip();
      clip.oversample = 'none';
      this.nodes.push(clip);
      sum.connect(glue).connect(this.master).connect(clip).connect(ctx.destination);
      this.output = clip;
    } else {
      sum.connect(this.master).connect(ctx.destination);
      this.output = this.master;
    }

    this.world = this.gain(1);
    this.muffleFilter = ctx.createBiquadFilter();
    this.muffleFilter.type = 'lowpass';
    this.muffleFilter.frequency.value = OPEN_HZ;
    this.muffleFilter.Q.value = 0.9;
    this.nodes.push(this.muffleFilter);
    this.worldVol = this.gain(1);
    this.world.connect(this.muffleFilter).connect(this.worldVol).connect(sum);

    this.reverb = this.gain(1);
    const conv = ctx.createConvolver();
    conv.buffer = streetImpulse(ctx, rng.fork('reverb'), REVERB_SEC);
    this.nodes.push(conv);
    const ret = this.gain(0.42);
    conv.connect(ret).connect(this.muffleFilter);
    this.reverbValve = new Valve(this.reverb, conv);

    this.ui = this.gain(1);
    this.uiVol = this.gain(1);
    this.ui.connect(this.uiVol).connect(sum);

    this.music = this.gain(1);
    this.duckGain = this.gain(1);
    this.musicVol = this.gain(0.6);
    this.music.connect(this.duckGain).connect(this.musicVol).connect(sum);
    this.sting = this.gain(1);
    this.sting.connect(this.musicVol);
  }

  setVolumes(master: number, music: number, sfx: number, t = this.ctx.currentTime): void {
    chase(this.master.gain, 0.85 * taper(master), t, 0.03);
    chase(this.musicVol.gain, 0.6 * taper(music), t, 0.03);
    chase(this.worldVol.gain, taper(sfx), t, 0.03);
    chase(this.uiVol.gain, taper(sfx), t, 0.03);
  }

  /** Lower the music by `amount` (0..1) for `seconds`, overlapping ducks keep the deepest/longest. */
  duck(amount: number, seconds: number, t = this.ctx.currentTime): void {
    const depth = Math.min(0.95, Math.max(0, amount));
    const until = t + Math.max(0.05, seconds);
    if (t < this.duckUntil) {
      this.duckDepth = Math.max(this.duckDepth, depth);
      this.duckUntil = Math.max(this.duckUntil, until);
    } else {
      this.duckDepth = depth;
      this.duckUntil = until;
    }
    retarget(this.duckGain.gain, 1 - this.duckDepth, t, 0.05);
    this.duckGain.gain.setTargetAtTime(1, this.duckUntil, 0.35);
  }

  /** Muffle the world (0 = open, 1 = under a blanket). With `holdSec` it recovers by itself (crash daze). */
  muffle(amount: number, t = this.ctx.currentTime, holdSec?: number): void {
    const a = Math.min(1, Math.max(0, amount));
    const hz = OPEN_HZ * Math.pow(MUFFLE_MIN_HZ / OPEN_HZ, a);
    retarget(this.muffleFilter.frequency, hz, t, 0.07);
    if (holdSec !== undefined) this.muffleFilter.frequency.setTargetAtTime(OPEN_HZ, t + holdSec, 0.45);
  }

  /** a one-shot is about to play at `t`: make sure the reverb is listening */
  wakeReverb(t = this.ctx.currentTime): void {
    this.reverbValve.want(true, t);
  }

  /** housekeeping: park the convolver once no one-shot has sounded for a reverb tail */
  tick(now: number, busy: boolean): void {
    this.reverbValve.want(busy, now, REVERB_SEC + 0.25);
    this.reverbValve.tick(now);
  }

  dispose(): void {
    this.reverbValve.dispose();
    for (const n of this.nodes) n.disconnect();
    this.nodes.length = 0;
  }

  private gain(v: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    this.nodes.push(g);
    return g;
  }

  private comp(threshold: number, knee: number, ratio: number, attack: number, release: number): DynamicsCompressorNode {
    const c = this.ctx.createDynamicsCompressor();
    c.threshold.value = threshold;
    c.knee.value = knee;
    c.ratio.value = ratio;
    c.attack.value = attack;
    c.release.value = release;
    this.nodes.push(c);
    return c;
  }
}
