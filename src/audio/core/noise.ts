import { Rng } from '../../core/rng';

/**
 * white/pink/brown: classic coloured noise. crackle: sparse sharp ticks (rain on asphalt, debris).
 * drops: sparse pitched "plinks" (fat drops on a helmet / shop awnings).
 */
export type NoiseKind = 'white' | 'pink' | 'brown' | 'crackle' | 'drops';

type Generator = (out: Float32Array, rng: Rng, sampleRate: number) => void;

const SECONDS: Record<NoiseKind, number> = { white: 2, pink: 3, brown: 4, crackle: 3, drops: 5 };
const FADE = 2048;
const cache = new WeakMap<BaseAudioContext, Map<NoiseKind, AudioBuffer>>();

const white: Generator = (o, r) => {
  for (let i = 0; i < o.length; i++) o[i] = r.next() * 2 - 1;
};

/** Paul Kellet's economy pink filter */
const pink: Generator = (o, r) => {
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < o.length; i++) {
    const w = r.next() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    o[i] = b0 + b1 + b2 + w * 0.1848;
  }
};

/** leaky integrator → ~6 dB/oct rolloff from ~140 Hz */
const brown: Generator = (o, r) => {
  let b = 0;
  for (let i = 0; i < o.length; i++) {
    b = (b + 0.02 * (r.next() * 2 - 1)) / 1.02;
    o[i] = b;
  }
};

const crackle: Generator = (o, r, sr) => {
  const events = Math.floor((o.length / sr) * 900);
  for (let e = 0; e < events; e++) {
    const at = Math.floor(r.next() * (o.length - 64));
    const amp = r.next() ** 3 * (r.chance(0.5) ? 1 : -1);
    const len = 2 + r.next() * 28;
    for (let k = 0; k < len * 3 && at + k < o.length; k++) o[at + k] += amp * Math.exp(-k / (len * 0.35));
  }
};

const drops: Generator = (o, r, sr) => {
  const events = Math.floor((o.length / sr) * 28);
  for (let e = 0; e < events; e++) {
    const at = Math.floor(r.next() * (o.length - sr * 0.03));
    const f = 1400 + r.next() * 3600;
    const amp = 0.2 + r.next() ** 2 * 0.8;
    const tau = (0.0015 + r.next() * 0.003) * sr;
    for (let k = 0; k < tau * 5; k++) o[at + k] += amp * Math.sin((2 * Math.PI * f * k) / sr) * Math.exp(-k / tau);
  }
};

const GEN: Record<NoiseKind, Generator> = { white, pink, brown, crackle, drops };

/** Crossfade the generated tail into the head so the buffer loops seamlessly, then normalise to 0.9 peak. */
function loopAndNormalize(raw: Float32Array, len: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(len);
  let peak = 1e-9;
  for (let i = 0; i < len; i++) {
    let s = raw[i];
    if (i < FADE) {
      const w = i / FADE;
      s = raw[i] * w + raw[len + i] * (1 - w);
    }
    out[i] = s;
    peak = Math.max(peak, Math.abs(s));
  }
  const k = 0.9 / peak;
  for (let i = 0; i < len; i++) out[i] *= k;
  return out;
}

/** Looping stereo noise buffer (decorrelated channels, seamless loop), generated once per context and kind. */
export function noiseBuffer(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  let byKind = cache.get(ctx);
  if (!byKind) {
    byKind = new Map();
    cache.set(ctx, byKind);
  }
  const hit = byKind.get(kind);
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * SECONDS[kind]);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + FADE);
    GEN[kind](raw, new Rng(0x51d0 + ch * 7919 + kind.charCodeAt(0) * 131 + kind.length), sr);
    buf.copyToChannel(loopAndNormalize(raw, len), ch);
  }
  byKind.set(kind, buf);
  return buf;
}
