/**
 * Tiny text notation for 16-step bars.
 *  Drum lane : one char per step — 'x' hit, 'X' accent, 'o' alternate (ghost snare / open ching / soft kick), '.' rest.
 *  Note lane : space-separated tokens per step — scale degree ("7"), '.' rest, '-' hold the previous note,
 *              prefix '~' = slide up into the note, suffix '!' = accent.
 */
export const STEPS = 16;

export interface Hit {
  vel: number;
  alt: boolean;
}

export interface Note {
  degree: number;
  /** length in steps */
  len: number;
  vel: number;
  slide: boolean;
}

/** per-step hits of one bar (null = rest) */
export function parseHits(src: string): Array<Hit | null> {
  const chars = src.replace(/\s+/g, '');
  const out: Array<Hit | null> = [];
  for (let i = 0; i < STEPS; i++) {
    const c = chars[i] ?? '.';
    out.push(c === 'x' ? { vel: 1, alt: false } : c === 'X' ? { vel: 1.2, alt: false } : c === 'o' ? { vel: 0.55, alt: true } : null);
  }
  return out;
}

/** per-step note onsets of one bar (null = nothing starts here) */
export function parseNotes(src: string): Array<Note | null> {
  const tokens = src.trim().split(/\s+/).filter(Boolean);
  const out: Array<Note | null> = new Array<Note | null>(STEPS).fill(null);
  let last: Note | null = null;
  for (let i = 0; i < STEPS; i++) {
    const tok = tokens[i] ?? '.';
    if (tok === '-') {
      if (last) last.len++;
      continue;
    }
    last = null;
    if (tok === '.') continue;
    const slide = tok.startsWith('~');
    const accent = tok.endsWith('!');
    const degree = Number.parseInt(tok.replace(/[~!]/g, ''), 10);
    if (!Number.isFinite(degree)) continue;
    last = { degree, len: 1, vel: accent ? 1.15 : 0.85 + ((i % 4 === 0) ? 0.1 : 0), slide };
    out[i] = last;
  }
  return out;
}
