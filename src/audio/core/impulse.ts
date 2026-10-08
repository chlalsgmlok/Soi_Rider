import type { Rng } from '../../core/rng';

/**
 * Procedural stereo "soi" reverb impulse: discrete early slaps off facing shophouse walls, then a noise tail that
 * darkens as it decays (high frequencies die first, like real street ambience).
 */
export function streetImpulse(ctx: BaseAudioContext, rng: Rng, seconds = 1.7, curve = 2.8): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    const r = rng.fork(`ir${ch}`);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      const k = 0.85 - 0.75 * x; // one-pole coefficient: bright at first, dark at the end
      lp += (r.next() * 2 - 1 - lp) * k;
      const onset = Math.min(1, i / (sr * 0.012));
      data[i] = lp * (1 - x) ** curve * onset * 0.55;
    }
    // early reflections: walls 3–14 m away on either side of a narrow soi
    for (let e = 0; e < 9; e++) {
      const at = Math.floor(sr * (0.006 + r.next() * 0.075));
      const amp = (0.75 - e * 0.07) * (r.chance(0.5) ? 1 : -1);
      for (let k = 0; k < 24 && at + k < len; k++) data[at + k] += amp * Math.exp(-k / 6);
    }
  }
  return buf;
}
