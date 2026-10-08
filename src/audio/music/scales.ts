/** Pitch helpers + Thai-flavoured pentatonic modes (semitones above the tonic). */
export const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export const SCALES = {
  /** lai yai — minor-pentatonic colour of molam / phin */
  laiYai: [0, 3, 5, 7, 10],
  /** lai sutsanaen — bright major pentatonic of luk thung pop */
  laiSut: [0, 2, 4, 7, 9],
} as const;

/** scale degree (0-based, may exceed the scale length → next octave) → MIDI note */
export function degreeMidi(root: number, scale: readonly number[], degree: number): number {
  const n = scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return root + oct * 12 + scale[idx];
}

export const degreeHz = (root: number, scale: readonly number[], degree: number): number => midiHz(degreeMidi(root, scale, degree));
