import type { MusicTrack, StingerName } from '../types';
import { SCALES } from './scales';

/** A loop (or one-shot stinger) in the 16-step notation of ./pattern.ts. Lanes cycle per bar. */
export interface TrackDef {
  bpm: number;
  /** delay of every odd 16th as a fraction of a step (shuffle feel) */
  swing: number;
  /** MIDI note of melody scale degree 0 */
  root: number;
  scale: readonly number[];
  /** bass transposition (semitones) relative to `root` */
  bassShift: number;
  bars: number;
  loop: boolean;
  kick: readonly string[];
  snare: readonly string[];
  ching: readonly string[];
  shaker?: readonly string[];
  klong?: readonly string[];
  bass: readonly string[];
  lead: readonly string[];
  /** alternative lead bars ('' = keep) swapped in at random on later passes so loops never repeat exactly */
  leadAlt?: readonly string[];
  leadVoice: 'phin' | 'ranat';
  /** khaen drone chord per bar (scale degrees) — null = tacet */
  pad: ReadonlyArray<readonly number[] | null>;
  /** khaen breathing level per step, digits 0–9 */
  padBreath: string;
  mix: { drums: number; bass: number; lead: number; pad: number; echo: number };
}

const REST = '. . . . . . . . . . . . . . . .';
const NONE = '................';

export const TRACKS: Record<MusicTrack, TrackDef> = {
  /** title: bright luk thung pop, E major pentatonic — "a new day on the soi" */
  title: {
    bpm: 122, swing: 0.06, root: 64, scale: SCALES.laiSut, bassShift: -24, bars: 8, loop: true,
    kick: ['x...x...x...x...'], snare: ['....x.......x...', '....x.......x...', '....x.......x...', '....x.......x.xo'],
    ching: ['x.o.x.o.x.o.x.o.'], shaker: ['oooooooooooooooo'],
    bass: ['0 . . 0 3 . 0 . 0 . . 0 3 . 4 .', '2 . . 2 4 . 2 . 3 . . 3 4 . 3 .'],
    lead: [
      '5 . 7 . 8 - 7 5 . 7 . 5 4 . 3 .', '4 . . 5 4 3 2 . 3 - . . . . . .',
      '5 . 7 . 8 - 9 8 . 7 . 5 7 . 8 .', '~10 - - - 9 8 7 . 8 - 7 5 . . . .',
      '8 . 8 . 9 8 7 . 5 . 7 . 8 . . .', '7 . 5 . 4 5 3 . 4 - . . . . . .',
      '3 . 4 . 5 . 7 5 4 . 3 . 2 . 3 .', '0 - - - . . 2 3 ~5 - - - . . . .',
    ],
    leadAlt: ['5 7 8 7 8 - 7 5 . 7 . 5 4 . 3 .', '', '5 . 7 . ~8 - 9 8 7 . 7 5 7 8 10 .', '', '', '', '3 . 4 5 . 5 7 5 4 . 3 2 . . 3 .', ''],
    leadVoice: 'phin', pad: [[0, 3, 5]], padBreath: '8484848484848484',
    mix: { drums: 0.85, bass: 0.9, lead: 1, pad: 0.32, echo: 0.22 },
  },
  /** garage: laid-back D minor pentatonic, soft rim and shaker */
  garage: {
    bpm: 92, swing: 0.12, root: 62, scale: SCALES.laiYai, bassShift: -24, bars: 4, loop: true,
    kick: ['x.......x.....x.'], snare: ['....o.......o...'], ching: ['o.......o.......'], shaker: ['.o.o.o.o.o.o.o.o'],
    bass: ['0 . . . . . 0 . 3 . . . 2 . . .', '3 . . . . . 3 . 4 . . . 2 . . .', '0 . . . . . 0 . 3 . . . 2 . . .', '2 . . . . . 2 . 1 . . . 0 . . .'],
    lead: [
      '. . . . 5 - - 7 6 - 5 - . . . .', '8 - - - 7 - 5 - 6 - - - . . . .',
      '. . . . 5 - - 7 8 - 9 - 8 - 7 -', '5 - - - - - - - . . 3 . 4 . . .',
    ],
    leadAlt: ['. . 3 . 5 - - 7 6 - 5 - . . 4 .', '', '. . . . 5 - 7 8 ~10 - 9 - 8 - 7 -', ''],
    leadVoice: 'phin', pad: [[0, 3, 5]], padBreath: '8888666688886666',
    mix: { drums: 0.6, bass: 0.8, lead: 0.85, pad: 0.42, echo: 0.35 },
  },
  /** riding by day: 136 bpm molam dance groove, A minor pentatonic (lai yai), phin riffs over khaen pump */
  ride_day: {
    bpm: 136, swing: 0.04, root: 57, scale: SCALES.laiYai, bassShift: -12, bars: 8, loop: true,
    kick: ['x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x.x.x.xx'],
    snare: ['....x..o....x..o', '....x..o....x..o', '....x..o....x..o', '....x...x.x.xxxx'],
    ching: ['x.o.x.o.x.o.x.o.'], shaker: ['xoxoxoxoxoxoxoxo'],
    klong: [NONE, NONE, NONE, '......x.....x.x.', NONE, NONE, NONE, '..x...x...xx.x.x'],
    bass: ['0 . 0 . 5 . 0 . 3 . 0 . 4 . 3 .', '2 . 2 . 7 . 2 . 3 . 3 . 4 . 3 .'],
    lead: [
      '10 . 9 10 . 8 7 . 8 . 10 . 9 8 7 .', '8 7 5 . 7 . 8 . 5 . . . 7 6 5 .',
      '10 . 9 10 . 12 11 . 10 . 9 . 8 . 9 .', '~10 - - - . 9 8 7 8 - 7 5 . . . .',
      '5 . 5 7 . 8 . 7 5 . 5 7 . 8 10 .', '11 . 10 . 8 . 9 . 8 7 5 . 7 - . .',
      '5 . 5 7 . 8 . 10 . 11 . 12 . 11 10 .', '10 - - - 9 - 8 - 7 - 8 - ~10 - - -',
    ],
    leadAlt: ['10 9 10 12 10 8 7 . 8 . 10 . 9 8 7 .', '', '10 . ~12 - 11 10 9 . 10 . 9 . 8 7 8 .', '', '5 5 7 5 . 8 . 7 5 . 5 7 8 10 12 .', '', '', ''],
    leadVoice: 'phin', pad: [[0, 3, 5]], padBreath: '9393939393939393',
    mix: { drums: 1, bass: 0.9, lead: 1, pad: 0.3, echo: 0.2 },
  },
  /** riding by night: half-time F# minor pentatonic, long bass, phin swimming in echo */
  ride_night: {
    bpm: 104, swing: 0.08, root: 54, scale: SCALES.laiYai, bassShift: -12, bars: 8, loop: true,
    kick: ['x.....x...x.....'], snare: ['........x.......', '........x.......', '........x.......', '........x.....o.'],
    ching: ['..o...o...o...o.'], shaker: ['..o...o...o...o.'],
    bass: ['0 - - - - - 0 - 3 - - - 2 - - -', '4 - - - - - 4 - 3 - - - 1 - - -'],
    lead: [
      '. . 5 . . . 7 . 8 - - - . . . .', '. . . . 10 - 8 - 7 - - - . . . .',
      '. . 5 . . . 7 . 8 - 10 - 11 - 10 -', '8 - - - - - - - . . . . . . . .',
      '. . 10 . . . 12 . 13 - - - 12 - 10 -', '. . . . 11 - 10 - 8 - - - . . . .',
      '. . 7 . 8 . 10 . 8 - 7 - 5 - - -', REST,
    ],
    leadAlt: ['', '. . . . 10 - ~12 - 10 - 8 - . . . .', '', '', '', '', '', '. . . . . . . . 5 . 7 . 8 . . .'],
    leadVoice: 'phin', pad: [[0, 3, 5], [0, 3, 5], [0, 3, 5], [0, 3, 5], [1, 4, 6], [1, 4, 6], [0, 3, 5], [0, 3, 5]],
    padBreath: '7777555577775555',
    mix: { drums: 0.72, bass: 1, lead: 0.9, pad: 0.45, echo: 0.45 },
  },
  /** results: happy luk thung shuffle in G major pentatonic, ranat lead */
  results: {
    bpm: 116, swing: 0.16, root: 55, scale: SCALES.laiSut, bassShift: -12, bars: 4, loop: true,
    kick: ['x.....x.x.......'], snare: ['....x.......x...'], ching: ['x.o.x.o.x.o.x.o.'],
    bass: ['0 . . 0 2 . 3 . 4 . . 4 3 . 2 .'],
    lead: [
      '5 . 6 . 7 . 8 . 10 . 8 . 7 . 8 .', '7 . 5 . 6 . 7 - . . . . . . . .',
      '8 . 9 . 10 . 12 . 11 . 10 . 9 . 10 .', '~10 - - - - - . . 7 8 10 . . . . .',
    ],
    leadAlt: ['5 6 7 . 8 . 10 . 12 . 10 . 8 . 7 .', '', '', '~12 - - - 10 - . . 7 8 10 . . . . .'],
    leadVoice: 'ranat', pad: [[0, 3, 5]], padBreath: '6666444466664444',
    mix: { drums: 0.8, bass: 0.9, lead: 1, pad: 0.32, echo: 0.2 },
  },
};

export const STINGERS: Record<StingerName, TrackDef> = {
  /** S grade: ranat sweeps up three octaves, snare roll, big khaen chord + ching */
  grade_s: {
    bpm: 132, swing: 0, root: 60, scale: SCALES.laiSut, bassShift: -24, bars: 2, loop: false,
    kick: [NONE, 'x...............'], snare: ['........x.x.xxXX', 'x...............'], ching: [NONE, 'o.......o.......'],
    bass: [REST, '0 - - - - - - - . . . . . . . .'],
    lead: ['0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15', '15! - - - - - - - 12 - - - 15 - - -'],
    leadVoice: 'ranat', pad: [null, [5, 8, 10]], padBreath: '9999999999998642',
    mix: { drums: 1, bass: 1, lead: 1.1, pad: 0.5, echo: 0.3 },
  },
};
