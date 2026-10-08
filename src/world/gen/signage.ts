import type { Rng } from '../../core/rng';
import type { DistrictDef } from './district-types';
import { pickColor } from './weighted';

/**
 * Per-building dressing choices handed to the visual builder through Placement.meta:
 *   wall / awning / sign  — hex colours for the Wall, Awning_A and Sign_Face materials
 *   text / textEn         — shop sign words (Thai, optional English)
 *   style                 — district sign style (shop | vertical | backpacker | mall | office)
 *   shutter               — open | half | closed (roller shutter state)
 */
export interface RowLook {
  wall: string;
  awning: string;
}

/** a run of identical shophouses shares wall + awning colours (owners repaint only some units) */
export function rowLook(rng: Rng, def: DistrictDef): RowLook {
  return { wall: pickColor(rng, def.palette.wall), awning: pickColor(rng, def.palette.awning) };
}

export function shopMeta(rng: Rng, def: DistrictDef, look: RowLook): Record<string, string> {
  const repaint = rng.chance(0.3);
  const meta: Record<string, string> = {
    wall: repaint ? pickColor(rng, def.palette.wall) : look.wall,
    awning: rng.chance(0.2) ? pickColor(rng, def.palette.awning) : look.awning,
    sign: pickColor(rng, def.palette.sign),
    text: rng.pick(def.signs.th),
    style: def.signs.style,
    shutter: rng.weighted(['open', 'half', 'closed'] as const, (s) => (s === 'open' ? 5 : s === 'half' ? 3 : 1.5)),
  };
  if (rng.chance(def.signs.style === 'backpacker' ? 0.6 : 0.2)) meta.textEn = rng.pick(def.signs.en);
  return meta;
}

/** minimart stripe pairs (generic convenience-store liveries, no real brands) */
const MART_LIVERIES: ReadonlyArray<readonly [string, string, string]> = [
  ['#34B04A', '#FF8A2A', 'มินิมาร์ท 24 ชม.'],
  ['#2F6FD6', '#3EE6D4', 'ร้านสะดวกซื้อ'],
  ['#E23C3C', '#FFF6E8', 'มาร์ท 24'],
  ['#F7C928', '#2F6FD6', 'ซุปเปอร์ 24'],
];

export function martMeta(rng: Rng): Record<string, string> {
  const [paint, paint2, text] = rng.pick(MART_LIVERIES);
  return { paint, paint2, text, textEn: '24H', style: 'shop' };
}
