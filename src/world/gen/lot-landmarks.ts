import { clamp } from '../../core/math2d';
import { lotPoint } from './lot-frame';
import { ON_GROUND } from './place-ctx';
import type { LotKit } from './lot-kit';

/** sign text / POI name carried into the anchor meta */
export interface LotInfo {
  sign?: string;
  poi?: string;
  poiTh?: string;
}

const named = (info: LotInfo): Record<string, string> => {
  const m: Record<string, string> = {};
  if (info.sign) m.sign = info.sign;
  if (info.poi) m.poi = info.poi;
  if (info.poiTh) m.poiTh = info.poiTh;
  return m;
};

/** wat compound: paved court, ordination hall set back behind a gate, trees and flower pots along the path */
export function buildTemple(K: LotKit, info: LotInfo): boolean {
  const { width: W, depth: D } = K.L;
  const s = clamp(Math.min((W - 16) / 18, (D - 14) / 30), 0.62, 1.3);
  const setback = clamp((D - 30 * s) * 0.55, 6, 14);
  const col = K.building(-9 * s, 9 * s, setback, setback + 30 * s);
  if (col < 0) return false;
  K.plaza(-W / 2, W / 2, 0, D);
  K.model('bld_temple', 0, setback, s, col, K.anchorMeta('temple', named(info)));
  K.fence(-4, 4, 'temple');
  for (const side of [-1, 1]) {
    K.prop('prop_raintree', side * (W / 2 - 5), 5.5, 0, 1.1);
    for (let v = 2.5; v < setback - 1.5; v += 3) K.prop('prop_bougainvillea', side * 3.2, v);
    for (let v = setback + 3; v < setback + 30 * s - 2; v += 8) K.prop('prop_palm', side * (9 * s + 3.5), v, 0, 1.05);
  }
  K.prop('prop_bin', W / 2 - 2, 1.5);
  return true;
}

/** street shrine (Erawan / Guanyin style): big spirit house on a paved plot ringed with garland pots */
export function buildShrine(K: LotKit, info: LotInfo): boolean {
  const { width: W, depth: D } = K.L;
  K.plaza(-W / 2, W / 2, 0, D);
  const s = clamp(Math.min(W, D) / 7.5, 1.4, 2.6);
  const c = lotPoint(K.L, 0, D / 2);
  const col = K.ctx.addCollider({ tag: 'furniture', circle: { cx: c.x, cz: c.z, r: 0.45 * s } });
  K.model('prop_spirit_house', 0, D / 2, s, col, K.anchorMeta('shrine', named(info)));
  K.ctx.occupyCircle(c.x, c.z, 0.9 * s);
  K.fence(-2.5, 2.5, 'temple');
  const r = 0.9 * s + 1.4;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.39;
    K.prop(k % 2 ? 'prop_pot_plant' : 'prop_bougainvillea', Math.cos(a) * r, D / 2 + Math.sin(a) * r, a);
  }
  for (const u of [-W / 2 + 1.5, W / 2 - 1.5]) K.prop('prop_palm', u, D - 1.5, 0, 0.9);
  return true;
}

/** podium mall behind a forecourt with palms, bins and drop-off frontage */
export function buildMall(K: LotKit, info: LotInfo): boolean {
  const { width: W, depth: D } = K.L;
  const s = clamp(Math.min((W - 4) / 32, (D - 9) / 30), 0.7, 1.35);
  const setback = clamp(D - 30 * s - 1, 6, 10);
  const col = K.building(-16 * s, 16 * s, setback, setback + 30 * s);
  if (col < 0) return false;
  K.plaza(-W / 2, W / 2, 0, D);
  K.model('bld_mall', 0, setback, s, col, K.anchorMeta('mall', named(info)));
  K.frontage(-16 * s, 16 * s, setback, 'commercial');
  for (let u = -W / 2 + 3; u <= W / 2 - 3; u += 7.5) K.prop('prop_palm', u, 2.2, 0, 1.1);
  for (const u of [-6, 6]) K.prop('prop_pot_plant', u, setback - 1.2);
  K.prop('prop_bin', 9, setback - 1.5);
  return true;
}

/** park: lawn (bare ground) with rain trees, a gated entrance plaza, paved cross paths and a front railing */
export function buildPark(K: LotKit, info: LotInfo): boolean {
  const { width: W, depth: D } = K.L;
  const gate = Math.min(12, W / 4);
  K.plaza(-gate, gate, 0, 12);
  K.plaza(-2.5, 2.5, 12, D - 6);
  K.plaza(-W / 2 + 8, W / 2 - 8, D / 2 - 2.5, D / 2 + 2.5);
  const t = lotPoint(K.L, -gate - 3, 6);
  const col = K.ctx.addCollider({ tag: 'tree', circle: { cx: t.x, cz: t.z, r: 0.6 } });
  K.model('prop_raintree', -gate - 3, 6, 1.3, col, K.anchorMeta('park', named(info)));
  K.ctx.occupyCircle(t.x, t.z, 1.6);
  K.fence(-gate, gate, 'park');
  for (let u = -W / 2 + 3; u <= W / 2 - 3; u += 8.5) if (Math.abs(u) > gate + 2) K.prop('prop_palm', u, 2.2, 0, 1, ON_GROUND);
  for (const u of [-gate + 1.5, gate - 1.5]) K.prop('prop_bougainvillea', u, 1.6);
  K.scatter(['prop_raintree', 'prop_raintree', 'prop_palm', 'prop_banana'], 12, 9);
  for (let v = 16; v < D - 8; v += 14) K.prop('prop_bin', 3.4, v);
  K.seal();
  return true;
}
