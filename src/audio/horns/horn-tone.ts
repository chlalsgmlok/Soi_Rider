import { saturate } from '../core/curves';
import type { Voice } from '../core/voice';
import type { HornSpec } from './horn-specs';

/** Filter/saturation chain shared by every horn: buzz → diaphragm resonance → darkening → DC/rumble cut. */
export function hornChain(ctx: BaseAudioContext, spec: HornSpec, dest: AudioNode): { input: AudioNode; nodes: AudioNode[] } {
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = Math.min(250, spec.freqs[0] * 0.6);
  hp.connect(dest);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = spec.lowpass;
  lp.Q.value = 0.7;
  lp.connect(hp);
  const peak = ctx.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = spec.formant;
  peak.Q.value = spec.q;
  peak.gain.value = 10;
  peak.connect(lp);
  const sat = ctx.createWaveShaper();
  sat.curve = saturate(spec.drive, 0.1);
  sat.oversample = '2x';
  sat.connect(peak);
  return { input: sat, nodes: [hp, lp, peak, sat] };
}

/** Schedule one horn gesture (a set of blasts) on a short-lived voice. */
export function playHornBlasts(
  v: Voice,
  spec: HornSpec,
  t: number,
  blasts: ReadonlyArray<readonly [number, number]>,
  pitch = 1,
): void {
  const chain = hornChain(v.ctx, spec, v.out);
  v.own(...chain.nodes);
  const amp = v.gain(0, chain.input);
  const last = blasts[blasts.length - 1];
  const end = t + last[0] + last[1] + spec.release + 0.05;
  const g = amp.gain;
  g.setValueAtTime(0, t);
  for (const [s, d] of blasts) {
    const a = t + s;
    g.setValueAtTime(0, a);
    g.linearRampToValueAtTime(1, a + spec.attack);
    g.setValueAtTime(1, a + Math.max(spec.attack, d));
    g.linearRampToValueAtTime(0, a + Math.max(spec.attack, d) + spec.release);
  }
  spec.freqs.forEach((f0, i) => {
    const o = v.osc(spec.wave, f0 * pitch, t, end, v.gain(spec.level / spec.freqs.length ** 0.5, amp));
    o.detune.value = (i - (spec.freqs.length - 1) / 2) * 4;
    for (const [s] of blasts) {
      o.frequency.setValueAtTime(f0 * pitch * (1 - spec.bend), t + s);
      o.frequency.linearRampToValueAtTime(f0 * pitch, t + s + 0.045);
    }
  });
}
