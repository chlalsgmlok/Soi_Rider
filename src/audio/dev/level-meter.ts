/** Level statistics of a rendered buffer (pure; works on anything shaped like an AudioBuffer). */
export interface BufferLike {
  readonly numberOfChannels: number;
  readonly length: number;
  getChannelData(channel: number): Float32Array;
}

export interface Levels {
  /** RMS over every channel and sample */
  rms: number;
  /** largest absolute sample */
  peak: number;
  /** loudest 50 ms window (RMS) — compares short transients with beds fairly */
  momentary: number;
  /** any NaN / ±Infinity sample */
  nan: boolean;
}

/** momentary-loudness window, seconds */
const WINDOW = 0.05;

export function measureLevels(b: BufferLike, sampleRate = 44100): Levels {
  const win = Math.max(1, Math.round(sampleRate * WINDOW));
  const energy = new Float64Array(Math.ceil(b.length / win));
  let sum = 0;
  let peak = 0;
  let nan = false;
  let n = 0;
  for (let ch = 0; ch < b.numberOfChannels; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const s = d[i];
      if (!Number.isFinite(s)) {
        nan = true;
        continue;
      }
      sum += s * s;
      energy[Math.floor(i / win)] += s * s;
      const a = s < 0 ? -s : s;
      if (a > peak) peak = a;
    }
    n += d.length;
  }
  let loudest = 0;
  for (const e of energy) loudest = Math.max(loudest, e);
  const momentary = Math.sqrt(loudest / (win * Math.max(1, b.numberOfChannels)));
  return { rms: n > 0 ? Math.sqrt(sum / n) : 0, peak, momentary, nan };
}

/** linear amplitude → dBFS (−Infinity for silence) */
export const dbfs = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -Infinity);
