import type { HornKind, HornPattern } from '../types';

/** Timbre of one horn type (data table). */
export interface HornSpec {
  /** simultaneous tones (dual-tone car horns, triple bus air horn) */
  freqs: number[];
  wave: OscillatorType;
  /** diaphragm/bell resonance peak */
  formant: number;
  q: number;
  /** saturation drive (buzz) */
  drive: number;
  lowpass: number;
  attack: number;
  release: number;
  /** pitch rise at each blast onset as a fraction (disc spin-up / air pressure building) */
  bend: number;
  level: number;
}

export const HORN_SPECS: Record<HornKind, HornSpec> = {
  player: { freqs: [500, 503.5], wave: 'square', formant: 1900, q: 2.4, drive: 2.5, lowpass: 5500, attack: 0.006, release: 0.035, bend: 0.04, level: 0.17 },
  moto: { freqs: [585, 589], wave: 'square', formant: 2200, q: 2.4, drive: 2.5, lowpass: 6000, attack: 0.006, release: 0.03, bend: 0.04, level: 0.15 },
  sedan: { freqs: [349, 440], wave: 'sawtooth', formant: 1250, q: 1.6, drive: 3, lowpass: 4200, attack: 0.012, release: 0.06, bend: 0.025, level: 0.15 },
  taxi: { freqs: [370, 466], wave: 'sawtooth', formant: 1350, q: 1.6, drive: 3, lowpass: 4500, attack: 0.01, release: 0.05, bend: 0.025, level: 0.15 },
  pickup: { freqs: [311, 392], wave: 'sawtooth', formant: 1000, q: 1.5, drive: 3.2, lowpass: 3600, attack: 0.014, release: 0.06, bend: 0.03, level: 0.16 },
  van: { freqs: [392, 494], wave: 'sawtooth', formant: 1400, q: 1.6, drive: 2.8, lowpass: 4600, attack: 0.012, release: 0.05, bend: 0.025, level: 0.15 },
  songthaew: { freqs: [330, 415], wave: 'sawtooth', formant: 1100, q: 1.5, drive: 3, lowpass: 3900, attack: 0.014, release: 0.06, bend: 0.03, level: 0.16 },
  tuktuk: { freqs: [1040], wave: 'square', formant: 2600, q: 2, drive: 1.6, lowpass: 7000, attack: 0.003, release: 0.02, bend: 0, level: 0.12 },
  bus: { freqs: [155, 196, 233], wave: 'sawtooth', formant: 520, q: 1.2, drive: 2.2, lowpass: 1700, attack: 0.06, release: 0.2, bend: 0.08, level: 0.2 },
};

/** Blast timing [start, duration] in seconds. */
export const HORN_PATTERNS: Record<HornPattern, ReadonlyArray<readonly [number, number]>> = {
  tap: [[0, 0.16]],
  double: [[0, 0.11], [0.17, 0.15]],
  long: [[0, 0.8]],
  angry: [[0, 0.09], [0.14, 0.09], [0.28, 0.7]],
};

/** the tuk-tuk's little electric beeper always goes pip-pip(-pip) */
export const TUKTUK_PIPS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0, 0.07], [0.11, 0.07]],
  [[0, 0.06], [0.1, 0.06], [0.2, 0.06]],
];

/** the player's scooter: "meep-meep" */
export const MEEP_MEEP: ReadonlyArray<readonly [number, number]> = [[0, 0.1], [0.15, 0.13]];
