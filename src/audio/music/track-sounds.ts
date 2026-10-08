import type { Rng } from '../../core/rng';
import type { Voice } from '../core/voice';
import type { AtlasEntry } from './sound-atlas';
import { ching, kick, klong, shaker, snare } from './inst-drums';
import { bass, khaen, NOTE_DECAY, phin, ranat } from './inst-melodic';
import { parseNotes } from './pattern';
import { degreeMidi, midiHz } from './scales';
import type { TrackDef } from './tracks';

/** What gets baked into the sample atlases: drum hits (shared by every track) and each track's notes + pads. */

export type DrumName = 'kick' | 'snare' | 'ching_o' | 'ching_c' | 'shaker' | 'klong_h' | 'klong_l';
export type NoteVoice = 'phin' | 'ranat' | 'bass';

/** baked variants per drum (random per hit so repeated hits never sound machine-gunned) */
const VARIANTS: Record<DrumName, number> = { kick: 1, snare: 3, ching_o: 2, ching_c: 3, shaker: 3, klong_h: 1, klong_l: 1 };
const DRUMS: ReadonlyArray<readonly [DrumName, number, (v: Voice, t: number) => void]> = [
  ['kick', 0.42, (v, t) => kick(v, t, 1)],
  ['snare', 0.26, (v, t) => snare(v, t, 1)],
  ['ching_o', 0.76, (v, t) => ching(v, t, 1, true)],
  ['ching_c', 0.16, (v, t) => ching(v, t, 1, false)],
  ['shaker', 0.12, (v, t) => shaker(v, t, 1)],
  ['klong_h', 0.36, (v, t) => klong(v, t, 1, true)],
  ['klong_l', 0.36, (v, t) => klong(v, t, 1, false)],
];

/** the longest ring each melodic voice can have — notes are baked at this length and shortened on playback */
export const BAKED_DECAY: Record<NoteVoice, number> = {
  phin: NOTE_DECAY.phin(Infinity),
  ranat: NOTE_DECAY.ranat(Infinity),
  bass: NOTE_DECAY.bass(Infinity),
};

export const drumKey = (name: DrumName, rng: Rng): string => `${name}#${rng.int(0, VARIANTS[name] - 1)}`;
export const noteKey = (voice: NoteVoice, midi: number): string => `${voice}:${midi}`;
export const padKey = (chord: readonly number[]): string => `pad:${chord.join('.')}`;

export function drumEntries(): AtlasEntry[] {
  const out: AtlasEntry[] = [];
  for (const [name, seconds, render] of DRUMS) {
    for (let i = 0; i < VARIANTS[name]; i++) out.push({ key: `${name}#${i}`, seconds, render });
  }
  return out;
}

const noteEntry = (voice: NoteVoice, midi: number): AtlasEntry => ({
  key: noteKey(voice, midi),
  seconds: BAKED_DECAY[voice] + 0.06,
  render: (v, t) => {
    const hz = midiHz(midi);
    if (voice === 'phin') phin(v, t, hz, 10, 1);
    else if (voice === 'ranat') ranat(v, t, hz, 10, 1);
    else bass(v, t, hz, 10, 1);
  },
});

/** every lead / bass pitch and khaen chord a track can play (including its alternative bars) */
export function trackEntries(d: TrackDef): AtlasEntry[] {
  const lead = new Set<number>();
  const low = new Set<number>();
  for (const bar of [...d.lead, ...(d.leadAlt ?? [])]) {
    for (const n of parseNotes(bar)) if (n) lead.add(degreeMidi(d.root, d.scale, n.degree));
  }
  for (const bar of d.bass) for (const n of parseNotes(bar)) if (n) low.add(degreeMidi(d.root + d.bassShift, d.scale, n.degree));
  const stepDur = 60 / d.bpm / 4;
  const flat = new Array<number>(16).fill(1);
  const pads = d.pad.filter((c): c is readonly number[] => c !== null);
  return [
    ...[...lead].map((m) => noteEntry(d.leadVoice, m)),
    ...[...low].map((m) => noteEntry('bass', m)),
    ...pads.map((chord) => ({
      key: padKey(chord),
      seconds: 16 * stepDur + 0.3,
      render: (v: Voice, t: number) =>
        khaen(v, t, stepDur, chord.map((deg) => midiHz(degreeMidi(d.root, d.scale, deg))), flat, 1),
    })),
  ];
}
