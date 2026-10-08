import { parseHits, parseNotes, STEPS, type Hit, type Note } from './pattern';
import type { TrackDef } from './tracks';

export type Bars<T> = Array<Array<T | null>>;

/** A TrackDef with every lane parsed into per-step events (cached per def). */
export interface ParsedTrack {
  kick: Bars<Hit>;
  snare: Bars<Hit>;
  ching: Bars<Hit>;
  shaker: Bars<Hit>;
  klong: Bars<Hit>;
  bass: Bars<Note>;
  lead: Bars<Note>;
  leadAlt: Array<Array<Note | null> | null>;
  /** khaen breathing level per step, 0..1 */
  breath: number[];
}

const cache = new WeakMap<TrackDef, ParsedTrack>();

export function parseTrack(d: TrackDef): ParsedTrack {
  const hit = cache.get(d);
  if (hit) return hit;
  const p: ParsedTrack = {
    kick: d.kick.map(parseHits), snare: d.snare.map(parseHits), ching: d.ching.map(parseHits),
    shaker: (d.shaker ?? []).map(parseHits), klong: (d.klong ?? []).map(parseHits),
    bass: d.bass.map(parseNotes), lead: d.lead.map(parseNotes),
    leadAlt: (d.leadAlt ?? []).map((s) => (s.trim() ? parseNotes(s) : null)),
    breath: [...d.padBreath].slice(0, STEPS).map((c) => (Number.parseInt(c, 10) || 0) / 9),
  };
  cache.set(d, p);
  return p;
}

/** event of a lane at (bar, step); lanes shorter than the track cycle */
export const laneAt = <T>(bars: Bars<T>, bar: number, step: number): T | null =>
  bars.length ? bars[bar % bars.length][step] : null;
