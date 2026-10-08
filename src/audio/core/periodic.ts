/**
 * Band-limited PeriodicWaves designed in the time domain: describe ONE cycle as `shape(phase 0..1)`, we take its
 * Fourier series (first `harmonics` partials) and let the browser render it alias-free at any pitch.
 */
const cache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

export type Shape = (phase: number) => number;

export function periodicFromShape(ctx: BaseAudioContext, key: string, shape: Shape, harmonics = 256): PeriodicWave {
  let byKey = cache.get(ctx);
  if (!byKey) {
    byKey = new Map();
    cache.set(ctx, byKey);
  }
  const hit = byKey.get(key);
  if (hit) return hit;
  const n = Math.max(1024, harmonics * 4);
  const x = new Float32Array(n);
  for (let k = 0; k < n; k++) x[k] = shape(k / n);
  const cos = new Float32Array(n);
  const sin = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    cos[k] = Math.cos((2 * Math.PI * k) / n);
    sin[k] = Math.sin((2 * Math.PI * k) / n);
  }
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let h = 1; h <= harmonics; h++) {
    let re = 0;
    let im = 0;
    for (let k = 0, idx = 0; k < n; k++, idx = (idx + h) % n) {
      re += x[k] * cos[idx];
      im += x[k] * sin[idx];
    }
    real[h] = (2 / n) * re;
    imag[h] = (2 / n) * im;
  }
  const wave = ctx.createPeriodicWave(real, imag);
  byKey.set(key, wave);
  return wave;
}

/** cyclic distance a − b wrapped to (−0.5, 0.5] */
const wrap = (d: number): number => d - Math.round(d);

/**
 * Exhaust pressure pulse train for one 720° engine cycle: when the exhaust valve cracks open the pressure jumps
 * (steep rise → rich 1/f harmonics that excite the muffler formants), then bleeds off with time constant
 * `width` (fraction of the cycle) and undershoots slightly (rarefaction).
 * `firing` = [phase 0..1, strength] per cylinder event (uneven twins = uneven phases).
 */
export function firingShape(firing: ReadonlyArray<readonly [number, number]>, width: number): Shape {
  const rise = width * 0.12;
  return (ph) => {
    let s = 0;
    for (const [at, k] of firing) {
      const d = (((ph - at) % 1) + 1) % 1;
      const attack = d < rise ? d / rise : 1;
      s += k * attack * (Math.exp(-d / width) - 0.3 * Math.exp(-d / (width * 3.5)) * (1 - Math.exp(-d / width)));
    }
    return s;
  };
}

/** Per-firing decaying envelope (used to amplitude-modulate exhaust breath / valve clatter noise). */
export function decayShape(firing: ReadonlyArray<readonly [number, number]>, decay: number): Shape {
  return (ph) => {
    let s = 0;
    for (const [at, k] of firing) {
      const d = (((ph - at) % 1) + 1) % 1;
      s += k * Math.exp(-d / decay);
    }
    return s;
  };
}

/** Repeating chirp gate: `count` short bursts at the start of each cycle (crickets, trills). */
export function chirpShape(count: number, spacing: number, width: number): Shape {
  return (ph) => {
    let s = 0;
    for (let i = 0; i < count; i++) {
      const d = wrap(ph - i * spacing);
      s += Math.exp(-(d * d) / (2 * width * width));
    }
    return s;
  };
}
