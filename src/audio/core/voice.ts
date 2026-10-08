import type { Rng } from '../../core/rng';
import { kRate } from './k-rate';
import { noiseBuffer, type NoiseKind } from './noise';

/**
 * One short-lived sound: a node factory that tracks its scheduled sources. When the last source has ended the
 * voice disconnects its output and every node registered with `own()`, so finished sounds are garbage collected.
 * Every source must be created synchronously (before any `ended` callback can fire), then call `seal()`.
 */
export class Voice {
  readonly out: GainNode;
  private live = 0;
  private sealed = false;
  private released = false;
  private owned: AudioNode[] = [];
  private onRelease: Array<() => void> = [];

  constructor(readonly ctx: BaseAudioContext, dest: AudioNode, readonly rng: Rng, gain = 1) {
    this.out = ctx.createGain();
    this.out.gain.value = gain;
    this.out.connect(dest);
  }

  /** gain stage; `dest` may be an AudioParam (modulation) or omitted (connect later) */
  gain(value: number, dest?: AudioNode | AudioParam): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    if (dest instanceof AudioParam) g.connect(dest);
    else if (dest) g.connect(dest);
    return g;
  }

  /** biquad with k-rate params: envelope sweeps step every 128 samples (inaudible) instead of per-sample coefficients */
  filter(type: BiquadFilterType, freq: number, q: number, dest: AudioNode, gainDb = 0): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.gain.value = gainDb;
    kRate(f.frequency, f.Q, f.detune, f.gain);
    f.connect(dest);
    return f;
  }

  shaper(curve: Float32Array<ArrayBuffer>, dest: AudioNode): WaveShaperNode {
    const s = this.ctx.createWaveShaper();
    s.curve = curve;
    s.oversample = '2x';
    s.connect(dest);
    return s;
  }

  panner(pan: number, dest: AudioNode): StereoPannerNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(dest);
    return p;
  }

  delay(seconds: number, dest: AudioNode): DelayNode {
    const d = this.ctx.createDelay(Math.max(1, seconds * 2));
    d.delayTime.value = seconds;
    d.connect(dest);
    return d;
  }

  osc(type: OscillatorType, freq: number, t0: number, t1: number, dest: AudioNode): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    this.track(o, t0, t1);
    return o;
  }

  wave(wave: PeriodicWave, freq: number, t0: number, t1: number, dest: AudioNode): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.setPeriodicWave(wave);
    o.frequency.value = freq;
    o.connect(dest);
    this.track(o, t0, t1);
    return o;
  }

  /** looping noise from a random offset (so repeated sounds never share the same grain) */
  noise(kind: NoiseKind, t0: number, t1: number, dest: AudioNode, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    const buf = noiseBuffer(this.ctx, kind);
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    s.connect(dest);
    this.live++;
    s.start(t0, this.rng.next() * buf.duration);
    s.stop(Math.max(t0 + 0.005, t1));
    s.onended = () => this.ended(s);
    return s;
  }

  /** extra nodes to disconnect when the voice finishes (panners, sends) */
  own(...nodes: AudioNode[]): void {
    this.owned.push(...nodes);
  }

  then(fn: () => void): void {
    if (this.released) fn();
    else this.onRelease.push(fn);
  }

  /** Call after scheduling. A voice without sources releases immediately. */
  seal(): void {
    this.sealed = true;
    if (this.live === 0) this.release();
  }

  private track(src: AudioScheduledSourceNode, t0: number, t1: number): void {
    this.live++;
    src.start(t0);
    src.stop(Math.max(t0 + 0.005, t1));
    src.onended = () => this.ended(src);
  }

  private ended(src: AudioNode): void {
    src.disconnect();
    this.live--;
    if (this.live <= 0 && this.sealed) this.release();
  }

  private release(): void {
    if (this.released) return;
    this.released = true;
    this.out.disconnect();
    for (const n of this.owned) n.disconnect();
    for (const fn of this.onRelease) fn();
    this.onRelease.length = 0;
  }
}
