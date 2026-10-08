import type { Voice } from '../core/voice';
import type { SfxParams } from '../types';

/** Schedules one sound on `v` (route everything into `v.out`) starting at audio time `t`. */
export type Recipe = (v: Voice, t: number, o: SfxParams) => void;

export interface SfxDef {
  play: Recipe;
  /** minimum seconds between two triggers of this sound (anti machine-gun) */
  gap: number;
  /** street-reverb send 0..1 */
  reverb: number;
  /** trim gain */
  gain: number;
}

export const def = (play: Recipe, gap = 0.05, reverb = 0.12, gain = 1): SfxDef => ({ play, gap, reverb, gain });
