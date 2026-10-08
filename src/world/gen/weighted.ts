import type { Rng } from '../../core/rng';
import { PALETTE, type PaletteKey } from '../../core/config/palette';
import type { Weights } from './district-types';

/** weighted pick from a sparse weight table (keys with weight ≤ 0 never win) */
export function pickW<K extends string>(rng: Rng, w: Weights<K>): K {
  const keys = Object.keys(w) as K[];
  return rng.weighted(keys, (k) => w[k] ?? 0);
}

/** weighted palette pick returned as a hex colour */
export function pickColor(rng: Rng, w: Weights<PaletteKey>): string {
  return PALETTE[pickW(rng, w)];
}

/** hex colour of a palette key */
export const hexOf = (k: PaletteKey): string => PALETTE[k];
