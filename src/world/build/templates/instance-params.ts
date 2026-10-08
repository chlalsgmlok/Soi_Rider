import { Vector4 } from 'three';
import { PALETTE } from '../../../core/config/palette';
import type { Placement } from '../../../core/types';
import type { PaletteRegistry } from './palette-registry';

/** roller shutter codes read by the uber shader (0/1 = as authored, half open) */
const SHUTTER = { half: 1, closed: 2, open: 3 } as const;

/** second facade colour (pilasters, string courses) — a different pastel from the same family */
const ACCENTS = [PALETTE.wallCream, PALETTE.wallWhite, PALETTE.wallSalmon, PALETTE.wallMint, PALETTE.wallPowder,
  PALETTE.wallLemon, PALETTE.wallPink, '#E9C9A0', '#D8E4D2'];

const seedOf = (variant: number): number => ((variant >>> 0) % 997) / 997;

function shutterCode(meta: Record<string, string> | undefined): number {
  const s = meta?.shutter;
  if (s === 'open' || s === 'half' || s === 'closed') return SHUTTER[s];
  return meta?.infill || meta?.fringe ? SHUTTER.closed : SHUTTER.half;
}

function accentFor(wall: string | undefined, variant: number): string {
  const w = (wall ?? '').toLowerCase();
  for (let k = 0; k < ACCENTS.length; k++) {
    const c = ACCENTS[((variant >>> 4) + k) % ACCENTS.length];
    if (c.toLowerCase() !== w) return c;
  }
  return PALETTE.wallWhite;
}

/**
 * Per-instance params of a placement in the city batch (see city-shader.ts): palette indices for the asset's tint
 * channels and shutter state + seed in w. Assets without tints still get a seed (window lights, sway phase).
 */
export function instanceParams(p: Placement, reg: PaletteRegistry): Vector4 {
  const m = p.meta;
  const seed = seedOf(p.variant);
  const v = new Vector4(0, 0, 0, seed);
  if (p.asset.startsWith('bld_shophouse')) {
    v.set(reg.index(m?.wall), reg.index(accentFor(m?.wall, p.variant)), reg.index(m?.awning), shutterCode(m) + seed);
  } else if (p.asset === 'bld_minimart') {
    v.set(reg.index(m?.paint), reg.index(m?.paint2), 0, seed);
  } else if (p.asset === 'prop_stool' || p.asset === 'prop_umbrella') {
    v.x = reg.index(m?.color);
  } else if (p.asset === 'prop_food_cart') {
    v.x = reg.index(m?.paint);
  } else if (p.asset === 'prop_barrier') {
    v.x = reg.index(p.variant % 2 === 0 ? PALETTE.curbRed : PALETTE.curbWhite);
  }
  return v;
}
