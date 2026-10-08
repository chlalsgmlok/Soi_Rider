import { PALETTE, type PaletteKey } from '../../../core/config/palette';
import type { Placement } from '../../../core/types';
import type { DistrictDef } from '../../districts';
import {
  busPlate, frameInk, lineInk, mallScreen, martSign, menuBoard, neonLine, soiPlate, stationSign, verticalInk, winSign,
} from './sign-designs';
import { inkOn, type SignPainter } from './sign-paint-kit';
import { CHINESE_SHOPS, DEFAULT_MENU, DEFAULT_MENU_TITLE, isFood, KOREAN_SHOPS, MENUS, SUBTITLES } from './sign-texts';

/** how a sign lights up at night: lightbox (whole face), neon (lettering only), plate (reflective, barely) */
export const GLOW = { box: 0, neon: 1, plate: 2 } as const;

/** face-uv rectangle [u0, vTop, u1, vBottom] (glTF uv: v = 0 at the top of the face) */
export type FaceRect = readonly [number, number, number, number];
export const WHOLE: FaceRect = [0, 0, 1, 1];

/** one atlas artwork laid on a region of the sign face */
export interface SignLayer {
  key: string;
  kind: string;
  px: readonly [number, number];
  paint: SignPainter;
  region: FaceRect;
}

/** a sign: board colour under its layers (stacked a few mm apart), lighting mode */
export interface SignSpec {
  layers: SignLayer[];
  board: string;
  glow: number;
}

export interface SignContext {
  def: DistrictDef;
  station: { th: string; ko: string };
}

const NEONS: readonly string[] = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonYellow, PALETTE.neonRed];
const CHINA_RED = '#C8231B';
const GOLD_INK = '#F1C75A';

/** stable small hash of a string (one neon colour per shop word keeps the atlas small) */
const hashOf = (t: string): number => [...t].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
const pickBy = <T>(list: readonly T[], v: number, shift = 0): T => list[((v >>> shift) % list.length + list.length) % list.length];
const chance = (v: number, shift: number, p: number): boolean => ((v >>> shift) & 1023) / 1024 < p;
const single = (key: string, kind: string, px: readonly [number, number], paint: SignPainter, glow: number = GLOW.box): SignSpec =>
  ({ layers: [{ key, kind, px, paint, region: WHOLE }], board: '#ffffff', glow });

/** shop words of a shophouse (fringe rows get one from the district list) */
export function shopWords(p: Placement, def: DistrictDef): { text: string; board: string } | null {
  if (p.meta?.text) return { text: p.meta.text, board: p.meta.sign ?? PALETTE.signBlue };
  if (!p.meta?.fringe) return null;
  const keys = Object.keys(def.palette.sign) as PaletteKey[];
  return { text: pickBy(def.signs.th, p.variant, 3), board: PALETTE[pickBy(keys, p.variant, 9)] };
}

/**
 * Shop fascia: a frame layer over the board colour, the shop word, and an optional second line (English, Thai
 * subtitle or Korean). Layers are shared between shops, so a whole city fits one atlas.
 */
function shopSign(p: Placement, c: SignContext): SignSpec | null {
  const w = shopWords(p, c.def);
  if (!w) return null;
  const v = p.variant;
  let second = p.meta?.textEn ?? (chance(v, 2, 0.45) ? SUBTITLES[w.text] : undefined);
  if (!second && c.def.id === 'sukhumvit' && chance(v, 5, 0.16)) second = pickBy(KOREAN_SHOPS, v, 7);
  const mainRegion: FaceRect = second ? [0.07, 0.12, 0.93, 0.64] : [0.07, 0.16, 0.93, 0.84];
  const subRegion: FaceRect = [0.24, 0.63, 0.76, 0.9];
  const neon = c.def.signs.style === 'backpacker' ? chance(v, 4, 0.7) : chance(v, 4, c.def.ambience.neon * 0.22);
  if (neon) {
    const color = pickBy(NEONS, hashOf(w.text));
    const layers: SignLayer[] = [
      { key: 'blank', kind: 'blank', px: [8, 8], paint: () => undefined, region: WHOLE },
      { key: `neon|${w.text}|${color}`, kind: 'shop', px: [288, 50], paint: neonLine(w.text, color), region: mainRegion },
    ];
    if (second) layers.push({ key: `neon2|${second}|${color}`, kind: 'sub', px: [160, 24], paint: neonLine(second, color), region: subRegion });
    return { layers, board: '#1b1622', glow: GLOW.neon };
  }
  const red = c.def.signs.style === 'vertical' && chance(v, 8, 0.5);
  const board = red ? CHINA_RED : w.board;
  const ink = red ? GOLD_INK : inkOn(board);
  const layers: SignLayer[] = [
    { key: `frame|${ink}`, kind: 'frame', px: [160, 30], paint: frameInk(ink), region: WHOLE },
    { key: `main|${w.text}|${ink}`, kind: 'shop', px: [288, 50], paint: lineInk(w.text, ink), region: mainRegion },
  ];
  if (second) layers.push({ key: `sub|${second}|${ink}`, kind: 'sub', px: [160, 24], paint: lineInk(second, ink, 600), region: subRegion });
  return { layers, board, glow: GLOW.box };
}

/** sign artwork for a template's Sign_Face part (null = leave it blank) */
export function specForPart(p: Placement, c: SignContext): SignSpec | null {
  const m = p.meta ?? {};
  switch (p.asset) {
    case 'bld_shophouse_2f':
    case 'bld_shophouse_3f':
    case 'bld_shophouse_4f':
      return m.infill ? null : shopSign(p, c);
    case 'bld_minimart':
      return single(`mart|${m.text}|${m.paint}|${m.paint2}`, 'mart', [288, 96], martSign(m.text ?? 'มินิมาร์ท', m.textEn ?? '24H', m.paint ?? '#34B04A', m.paint2 ?? '#FF8A2A'));
    case 'bld_mall':
      return single(`mall|${m.sign ?? m.poi}`, 'mall', [288, 160], mallScreen(m.sign ?? 'MEGA MALL'));
    case 'bts_station':
      return single(`station|${c.station.th}`, 'station', [512, 48], stationSign(c.station.th, c.station.ko));
    case 'prop_soi_sign':
      return single(`soi|${m.textTh}|${m.text}`, 'soi', [176, 54], soiPlate(m.textTh ?? 'ซอย', m.text ?? 'Soi'), GLOW.plate);
    case 'prop_win_stand':
      return single(`win|${m.number}`, 'win', [160, 40], winSign(m.number ?? '1'));
    case 'prop_bus_stop': {
      const routes = [m.route ?? '2', String(8 + (p.variant % 90)), String(500 + (p.variant % 40))];
      return single(`bus|${routes.join(',')}`, 'bus', [112, 70], busPlate(routes), GLOW.plate);
    }
    default:
      return null;
  }
}

/** a vertical board beside the fascia: Yaowarat red/gold Han characters, gold shops, the odd big Thai sign */
export function verticalSpec(p: Placement, c: SignContext): SignSpec | null {
  const w = shopWords(p, c.def);
  if (!w || p.meta?.infill) return null;
  const gold = w.text.includes('ทอง');
  const china = c.def.signs.style === 'vertical';
  if (!(gold || (china && chance(p.variant, 11, 0.75)) || chance(p.variant, 11, 0.08))) return null;
  const text = china || gold ? pickBy(CHINESE_SHOPS, p.variant, 13) : w.text;
  const board = china || gold ? CHINA_RED : w.board;
  const ink = china || gold ? GOLD_INK : inkOn(board);
  return { layers: [{ key: `vert|${text}|${ink}`, kind: 'vertical', px: [44, 132], paint: verticalInk(text, ink), region: WHOLE }], board, glow: GLOW.box };
}

/** chalkboard A-frame menu in front of an open food shop */
export function menuSpec(p: Placement, c: SignContext): SignSpec | null {
  const w = shopWords(p, c.def);
  if (!w || p.meta?.infill || p.meta?.fringe || p.meta?.shutter === 'closed' || !isFood(w.text)) return null;
  if (!chance(p.variant, 15, 0.45)) return null;
  const items = MENUS[w.text] ?? DEFAULT_MENU;
  const title = MENUS[w.text] ? w.text : DEFAULT_MENU_TITLE;
  return single(`menu|${title}`, 'menu', [88, 126], menuBoard(title, items), GLOW.plate);
}

/** red header board over a street-food cart */
export function cartSpec(p: Placement): SignSpec | null {
  const text = p.meta?.text;
  if (!text) return null;
  return { layers: [{ key: `main|${text}|#fffaf0`, kind: 'shop', px: [288, 50], paint: lineInk(text, '#fffaf0'), region: WHOLE }], board: '#D8343A', glow: GLOW.box };
}
