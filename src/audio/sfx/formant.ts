import type { Voice } from '../core/voice';

/** Cartoon voice synthesis: glottal saw + breath noise through three vowel formants (F1–F3). */
export interface Vowel {
  f1: number;
  f2: number;
  f3: number;
}

export const VOWEL = {
  a: { f1: 800, f2: 1250, f3: 2600 },
  e: { f1: 480, f2: 2000, f3: 2650 },
  i: { f1: 300, f2: 2350, f3: 3000 },
  o: { f1: 500, f2: 880, f3: 2500 },
  u: { f1: 330, f2: 820, f3: 2400 },
  ae: { f1: 680, f2: 1750, f3: 2550 },
  uh: { f1: 600, f2: 1150, f3: 2450 },
} as const satisfies Record<string, Vowel>;

export interface Utterance {
  t: number;
  dur: number;
  /** pitch contour: [time 0..1, Hz] */
  f0: ReadonlyArray<readonly [number, number]>;
  /** vowel path: [time 0..1, vowel] */
  vowels: ReadonlyArray<readonly [number, Vowel]>;
  /** 0 = fully voiced … 1 = whisper / breath only */
  breath: number;
  gain: number;
  attack?: number;
  release?: number;
  /** vibrato depth in cents */
  vibrato?: number;
  /** formant scale: >1 smaller head (child / small dog), <1 bigger */
  scale?: number;
  /** lip trill rate in Hz ("brrr") */
  trill?: number;
}

const BANDS: ReadonlyArray<readonly [keyof Vowel, number, number]> = [['f1', 90, 1], ['f2', 120, 0.55], ['f3', 170, 0.3]];

/** Schedule one utterance on the voice. */
export function speak(v: Voice, u: Utterance, dest: AudioNode = v.out): void {
  const end = u.t + u.dur;
  const stop = end + 0.05;
  const k = u.scale ?? 1;
  // lip trill multiplies the enveloped voice (so it can never leak past the envelope)
  let out: AudioNode = dest;
  if (u.trill) {
    const stage = v.gain(0.6, dest);
    v.osc('square', u.trill, u.t, stop, v.filter('lowpass', u.trill * 3, 0.7, v.gain(0.4, stage.gain)));
    out = stage;
  }
  const amp = v.gain(0, out);
  const voiced = v.gain(1 - u.breath);
  const breath = v.gain(u.breath * 2.2);
  for (const [key, bw, g] of BANDS) {
    const f = v.filter('bandpass', u.vowels[0][1][key] * k, (u.vowels[0][1][key] * k) / bw, v.gain(g * 6, amp));
    voiced.connect(f);
    breath.connect(f);
    f.frequency.setValueAtTime(u.vowels[0][1][key] * k, u.t);
    for (const [at, vow] of u.vowels) f.frequency.linearRampToValueAtTime(vow[key] * k, u.t + at * u.dur);
  }
  const glottis = v.osc('sawtooth', u.f0[0][1], u.t, stop, v.filter('lowpass', 3500, 0.7, voiced));
  glottis.frequency.setValueAtTime(u.f0[0][1], u.t);
  for (const [at, hz] of u.f0) glottis.frequency.linearRampToValueAtTime(hz, u.t + at * u.dur);
  if (u.vibrato) v.osc('sine', 5.5, u.t, stop, v.gain(u.vibrato, glottis.detune));
  v.noise('white', u.t, stop, breath);

  const attack = u.attack ?? 0.03;
  const release = u.release ?? 0.08;
  const g = amp.gain;
  g.setValueAtTime(0, u.t);
  g.linearRampToValueAtTime(u.gain, u.t + attack);
  g.setValueAtTime(u.gain, Math.max(u.t + attack, end - release));
  g.linearRampToValueAtTime(0, end);
}
