/** WaveShaper transfer curves. WaveShaperNode copies the array, so one cached curve can serve every node. */
const cache = new Map<string, Float32Array<ArrayBuffer>>();
const N = 2048;

function build(key: string, f: (x: number) => number): Float32Array<ArrayBuffer> {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = new Float32Array(N);
  for (let i = 0; i < N; i++) c[i] = f((i / (N - 1)) * 2 - 1);
  cache.set(key, c);
  return c;
}

/**
 * tanh saturation normalised to ±1 at the input extremes. `asym` > 0 bends the positive half harder,
 * which adds even harmonics (the "bark" of a loaded single cylinder).
 */
export function saturate(drive: number, asym = 0): Float32Array<ArrayBuffer> {
  const d = Math.max(0.1, drive);
  return build(`sat:${d.toFixed(2)}:${asym.toFixed(2)}`, (x) => {
    const k = x > 0 ? d * (1 + asym) : d;
    return Math.tanh(k * x) / Math.tanh(k);
  });
}

/**
 * Transparent safety limiter: identity below `knee`, then a tanh knee that approaches (never reaches) `ceiling`.
 * Slope is continuous at the knee, so quiet material is untouched.
 */
export function safetyClip(knee = 0.6, ceiling = 0.97): Float32Array<ArrayBuffer> {
  const room = ceiling - knee;
  return build(`clip:${knee}:${ceiling}`, (x) => {
    const a = Math.abs(x);
    if (a <= knee) return x;
    return Math.sign(x) * (knee + room * Math.tanh((a - knee) / room));
  });
}

/** half-wave rectifier: turns a zero-mean modulator into a unipolar gate */
export function rectifier(): Float32Array<ArrayBuffer> {
  return build('rect', (x) => Math.max(0, x));
}
