import type { UiSfx } from '../../core/events';
import type { Rng } from '../../core/rng';
import { spatialize, type Listener } from '../core/spatial';
import { Voice } from '../core/voice';
import type { Mixer } from '../mixer';
import type { Clock, SfxName, SfxOpts, SfxParams } from '../types';
import type { SfxDef } from './sfx-def';
import { SFX } from './registry';
import { UI_SFX } from './ui-sounds';

/** hard cap on simultaneous one-shot voices (new sounds are dropped beyond it) */
const MAX_VOICES = 40;
const AUDIBLE = 0.004;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

const num = (v: number | undefined, fallback: number): number => (v !== undefined && Number.isFinite(v) ? v : fallback);

function params(o: SfxOpts): SfxParams {
  const pitch = num(o.pitch, 1);
  return {
    intensity: clamp(num(o.intensity, 0.6), 0, 1),
    combo: Math.max(0, Math.floor(num(o.combo, 0))),
    speedKmh: Math.max(0, num(o.speedKmh, 30)),
    side: o.side === 'left' ? -1 : o.side === 'right' ? 1 : 0,
    pitch: pitch > 0 ? pitch : 1,
  };
}

/**
 * Plays one-shot recipes: per-sound retrigger gap, voice cap, world-position → pan / distance gain / air
 * absorption, a street-reverb send that grows with distance, and automatic cleanup when the sound has ended.
 */
export class SfxPlayer {
  private readonly last = new Map<string, number>();
  private active = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly mixer: Mixer,
    private readonly rng: Rng,
    private readonly listener: Listener,
    private readonly clock: Clock,
  ) {}

  /** number of one-shot voices currently sounding */
  get voices(): number {
    return this.active;
  }

  play(name: SfxName, opts: SfxOpts = {}): void {
    this.run(SFX[name], name, opts, false);
  }

  ui(name: UiSfx, gain = 1): void {
    this.run(UI_SFX[name], `ui:${name}`, { gain }, true);
  }

  /** an ad-hoc recipe on the world bus with the same spatial / lifetime handling (horns, thunder) */
  custom(key: string, d: SfxDef, opts: SfxOpts = {}): void {
    this.run(d, key, opts, false);
  }

  private run(d: SfxDef | undefined, key: string, o: SfxOpts, ui: boolean): void {
    if (!d) return;
    const t = this.clock() + 0.005 + Math.max(0, o.delay ?? 0);
    if (t - (this.last.get(key) ?? -Infinity) < d.gap) return;
    if (this.active >= MAX_VOICES) return;
    let gain = d.gain * (o.gain ?? 1);
    let pan = o.pan ?? 0;
    let cutoff = 0;
    let distance = 0;
    if (o.pos) {
      const m = spatialize(this.listener, o.pos);
      gain *= m.gain;
      pan = m.pan;
      cutoff = m.cutoff;
      distance = m.distance;
    }
    if (!(gain > AUDIBLE)) return;
    this.last.set(key, t);

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = clamp(Number.isFinite(pan) ? pan : 0, -1, 1);
    panner.connect(ui ? this.mixer.ui : this.mixer.world);
    const owned: AudioNode[] = [panner];
    let input: AudioNode = panner;
    if (cutoff > 0 && cutoff < 15000) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      lp.connect(panner);
      owned.push(lp);
      input = lp;
    }
    const v = new Voice(this.ctx, input, this.rng, Math.min(gain, 4));
    const send = ui ? 0 : Math.min(0.9, d.reverb + distance / 300);
    if (send > 0.01) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      v.out.connect(s);
      s.connect(this.mixer.reverb);
      owned.push(s);
      this.mixer.wakeReverb(t);
    }
    v.own(...owned);
    this.active++;
    v.then(() => {
      this.active--;
    });
    try {
      d.play(v, t, params(o));
    } catch (err) {
      console.error(`[audio] sound "${key}" failed`, err);
    }
    v.seal();
  }
}
