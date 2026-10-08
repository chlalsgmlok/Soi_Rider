import { def, type SfxDef } from './sfx-def';
import { VOWEL, speak } from './formant';
import { burst, jitterGains, scatter, ticks } from './sfx-kit';

/** Cartoon vocalisations (passengers, pedestrians, soi dogs, tokay geckos) — expressive, never words. */

const cough = def((v, t, o) => {
  const n = 2 + (v.rng.chance(0.4) ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const at = t + k * (0.22 + v.rng.next() * 0.05);
    const p = o.pitch * (1 - k * 0.04);
    burst(v, at, 'white', 'highpass', 3000, 0.7, 0.0005, 0.006, 0.18);
    speak(v, {
      t: at, dur: 0.17, f0: [[0, 175 * p], [1, 120 * p]], vowels: [[0, VOWEL.a], [1, VOWEL.uh]],
      breath: 0.65, gain: 0.7 * (1 - k * 0.15), attack: 0.004, release: 0.09,
    });
    burst(v, at, 'white', 'bandpass', 1200, 0.8, 0.002, 0.12, 0.22);
  }
}, 0.6, 0.08);

/** startled inhale "h-haah!" */
const gasp = def((v, t, o) => {
  speak(v, { t, dur: 0.08, f0: [[0, 330 * o.pitch], [1, 300 * o.pitch]], vowels: [[0, VOWEL.uh], [1, VOWEL.uh]], breath: 0.3, gain: 0.22, attack: 0.005, release: 0.03 });
  speak(v, {
    t: t + 0.05, dur: 0.36, f0: [[0, 420 * o.pitch], [1, 380 * o.pitch]], vowels: [[0, VOWEL.uh], [0.5, VOWEL.a], [1, VOWEL.a]],
    breath: 0.92, gain: 0.75, attack: 0.07, release: 0.05,
  });
}, 0.5, 0.08);

const yay = def((v, t, o) => {
  speak(v, {
    t, dur: 0.42, f0: [[0, 290 * o.pitch], [0.3, 360 * o.pitch], [1, 300 * o.pitch]],
    vowels: [[0, VOWEL.i], [0.18, VOWEL.e], [0.7, VOWEL.e], [1, VOWEL.i]],
    breath: 0.15, gain: 0.5, attack: 0.02, release: 0.12, vibrato: 25,
  });
}, 0.6, 0.1);

/** small crowd: "yeah!" / "woo!" voices and a ripple of applause */
const cheer = def((v, t, o) => {
  for (let k = 0; k < 5; k++) {
    const p = (200 + v.rng.next() * 150) * o.pitch;
    const at = t + v.rng.next() * 0.25;
    const woo = k % 2 === 1;
    speak(v, {
      t: at, dur: 0.5 + v.rng.next() * 0.3, f0: [[0, p], [0.35, p * 1.25], [1, p * 1.05]],
      vowels: woo ? [[0, VOWEL.u], [1, VOWEL.o]] : [[0, VOWEL.i], [0.25, VOWEL.e], [1, VOWEL.a]],
      breath: 0.2, gain: 0.2, attack: 0.03, release: 0.15, vibrato: 30, scale: 0.95 + v.rng.next() * 0.15,
    });
  }
  const claps = scatter(v, 32, 0.05, 1.4);
  ticks(v, t, claps, jitterGains(v, claps.length, 0.15, 0.4), 1400, 1.1, 0.025);
}, 1.2, 0.3);

/** annoyed "hmph… pff" */
const grumble = def((v, t, o) => {
  speak(v, {
    t, dur: 0.38, f0: [[0, 150 * o.pitch], [0.6, 135 * o.pitch], [1, 110 * o.pitch]],
    vowels: [[0, VOWEL.u], [0.7, VOWEL.u], [1, VOWEL.uh]], breath: 0.25, gain: 0.5,
  });
  burst(v, t + 0.32, 'white', 'bandpass', 900, 0.9, 0.005, 0.12, 0.22);
}, 0.6, 0.08);

/** cold and wet "brrrr" */
const shiver = def((v, t, o) => {
  speak(v, {
    t, dur: 0.65, f0: [[0, 210 * o.pitch], [1, 170 * o.pitch]], vowels: [[0, VOWEL.u], [1, VOWEL.u]],
    breath: 0.35, gain: 0.5, trill: 26, attack: 0.04, release: 0.12,
  });
}, 0.8, 0.08);

/** tonal Thai-ish chatter (three quick syllables) */
const chat = def((v, t, o) => {
  const sylls = [VOWEL.a, VOWEL.e, VOWEL.a];
  sylls.forEach((vow, k) => {
    const at = t + k * 0.14;
    const p = (220 + v.rng.next() * 80) * o.pitch;
    const rise = v.rng.chance(0.5) ? 1.25 : 0.8;
    burst(v, at, 'white', 'highpass', 2500, 0.7, 0.0008, 0.015, 0.12);
    speak(v, { t: at + 0.01, dur: 0.11, f0: [[0, p], [1, p * rise]], vowels: [[0, VOWEL.uh], [0.4, vow], [1, vow]], breath: 0.15, gain: 0.35, attack: 0.01, release: 0.04 });
  });
}, 0.5, 0.06);

/** soi dog: "woof woof" */
const dog = def((v, t, o) => {
  const n = 2 + (v.rng.chance(0.4) ? 1 : 0);
  for (let k = 0; k < n; k++) {
    speak(v, {
      t: t + k * 0.28, dur: 0.14, f0: [[0, 420 * o.pitch], [0.3, 520 * o.pitch], [1, 300 * o.pitch]],
      vowels: [[0, VOWEL.a], [0.4, VOWEL.a], [1, VOWEL.u]], breath: 0.35, gain: 0.55, attack: 0.006, release: 0.05, scale: 0.8,
    });
  }
}, 2, 0.35);

/** tokay gecko: a throaty rattle, then "tuk-KAE … tuk-KAE …" fading out */
const gecko = def((v, t, o) => {
  const rattle = Array.from({ length: 16 }, (_, k) => k * 0.028);
  ticks(v, t, rattle, [0.25, 0.18], 900, 2, 0.02);
  const calls = 3 + Math.floor(v.rng.next() * 3);
  for (let k = 0; k < calls; k++) {
    const at = t + 0.6 + k * 0.85;
    const fade = 1 - k * 0.15;
    speak(v, { t: at, dur: 0.09, f0: [[0, 240 * o.pitch], [1, 200 * o.pitch]], vowels: [[0, VOWEL.u], [1, VOWEL.o]], breath: 0.2, gain: 0.45 * fade, attack: 0.005, release: 0.03 });
    speak(v, {
      t: at + 0.16, dur: 0.3, f0: [[0, 330 * o.pitch], [0.3, 360 * o.pitch], [1, 250 * o.pitch]],
      vowels: [[0, VOWEL.ae], [1, VOWEL.e]], breath: 0.15, gain: 0.5 * fade, attack: 0.01, release: 0.1,
    });
  }
}, 6, 0.4);

export const VOICE_SFX = { cough, gasp, yay, cheer, grumble, shiver, chat, dog, gecko } satisfies Record<string, SfxDef>;
