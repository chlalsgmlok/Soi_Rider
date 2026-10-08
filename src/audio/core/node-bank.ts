import type { Rng } from '../../core/rng';
import { kRate } from './k-rate';
import { noiseBuffer, type NoiseKind } from './noise';

type Dest = AudioNode | AudioParam;

function link(node: AudioNode, dest: Dest | undefined): void {
  if (!dest) return;
  if (dest instanceof AudioParam) node.connect(dest);
  else node.connect(dest);
}

/**
 * Owner of a long-lived node graph (engine, ride noise, ambience beds, held horn). Sources start immediately and
 * run until `dispose()`, which stops them and disconnects every node once they have ended. Filter and oscillator
 * params are k-rate: these graphs are steered from JS at frame rate, never by sample-accurate envelopes.
 */
export class NodeBank {
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private disposed = false;

  constructor(readonly ctx: BaseAudioContext, private readonly rng: Rng) {}

  gain(value: number, dest?: Dest): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    link(g, dest);
    this.nodes.push(g);
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q: number, dest?: Dest): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    kRate(f.frequency, f.Q, f.detune, f.gain);
    link(f, dest);
    this.nodes.push(f);
    return f;
  }

  shaper(curve: Float32Array<ArrayBuffer>, dest?: Dest): WaveShaperNode {
    const s = this.ctx.createWaveShaper();
    s.curve = curve;
    s.oversample = '2x';
    link(s, dest);
    this.nodes.push(s);
    return s;
  }

  panner(pan: number, dest?: Dest): StereoPannerNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    link(p, dest);
    this.nodes.push(p);
    return p;
  }

  osc(freq: number, shape: OscillatorType | PeriodicWave, dest?: Dest): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (typeof shape === 'object') o.setPeriodicWave(shape);
    else o.type = shape;
    o.frequency.value = freq;
    kRate(o.frequency, o.detune);
    link(o, dest);
    o.start(this.ctx.currentTime);
    this.sources.push(o);
    this.nodes.push(o);
    return o;
  }

  /** looping noise from a random offset; `rate` < 1 stretches it into slow modulation */
  noise(kind: NoiseKind, rate = 1, dest?: Dest): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    const buf = noiseBuffer(this.ctx, kind);
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    link(s, dest);
    s.start(this.ctx.currentTime, this.rng.next() * buf.duration);
    this.sources.push(s);
    this.nodes.push(s);
    return s;
  }

  /** stop every source at `t` (default now) and free the graph once they have ended */
  dispose(t = this.ctx.currentTime): void {
    if (this.disposed) return;
    this.disposed = true;
    let left = this.sources.length;
    const free = (): void => {
      for (const n of this.nodes) n.disconnect();
      this.nodes.length = 0;
    };
    if (left === 0) {
      free();
      return;
    }
    for (const s of this.sources) {
      s.onended = () => {
        if (--left === 0) free();
      };
      s.stop(Math.max(t, this.ctx.currentTime));
    }
  }
}
