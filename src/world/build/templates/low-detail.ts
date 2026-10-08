import type { BufferGeometry } from 'three';
import { blob } from '../kit/blob';
import { type GroundFrame, slab } from '../kit/frame-shapes';
import { MeshBuilder } from '../kit/mesh-builder';
import { EMIS, kindCode, MATTE_METAL, TINT } from './material-rules';
import type { BakedTemplate } from './template-types';

/** template frame: s = +z (depth toward the street), l = +x (width) */
const FRAME: GroundFrame = { o: { x: 0, z: 0 }, d: { x: 0, z: 1 } };

const TOWER: Record<string, { wall: string; window: string; crown: string; band: number }> = {
  bld_condo: { wall: '#F2EFE8', window: '#5E8FAD', crown: '#C6D4E6', band: 1.5 },
  bld_office: { wall: '#EAF0F3', window: '#4F87C4', crown: '#4A80B2', band: 2.3 },
};

/** tower shaft with lit-able floor bands, crown and blinking aviation lamp (~15 % of the authored triangles) */
function lowTower(t: BakedTemplate, mb: MeshBuilder): void {
  const look = TOWER[t.name] ?? TOWER.bld_condo;
  const b = t.bounds;
  const [x0, x1, z0, z1] = [b.min.x * 0.94, b.max.x * 0.94, b.min.z * 0.97, Math.min(b.max.z, 0.5)];
  const top = b.max.y * 0.9;
  mb.color(look.wall).surf(0.8).kind(kindCode(TINT.none, EMIS.none));
  slab(mb, FRAME, z0, z1, x0, x1, -0.6, top);
  mb.color(look.window).surf(0.18).kind(kindCode(TINT.none, EMIS.window));
  for (let y = 3.6; y + look.band < top - 1; y += 3) slab(mb, FRAME, z0 - 0.03, z1 + 0.03, x0 - 0.03, x1 + 0.03, y, y + look.band, { top: false });
  const [mx, mz, cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) * 0.3, (z1 - z0) * 0.3];
  mb.color(look.crown).surf(0.6).kind(kindCode(TINT.none, EMIS.none));
  slab(mb, FRAME, mz - cz, mz + cz, mx - cx, mx + cx, top, b.max.y * 0.97);
  mb.color('#ff2a2a').surf(0.4).kind(kindCode(TINT.none, EMIS.aviation));
  slab(mb, FRAME, mz - 0.3, mz + 0.3, mx - 0.3, mx + 0.3, b.max.y * 0.97, b.max.y * 0.97 + 0.6);
}

/** shophouse block: tinted walls, glowing shop front, tinted awning, window bands per floor, parapet */
function lowShophouse(t: BakedTemplate, mb: MeshBuilder): void {
  const H = t.bounds.max.y > 14 ? 13.5 : t.bounds.max.y > 11 ? 10.5 : 7.5;
  mb.color('#eed9b2').surf(0.8).kind(kindCode(TINT.ch1, EMIS.none));
  slab(mb, FRAME, -10, 0, -2, 2, -0.6, H - 0.5);
  mb.kind(kindCode(TINT.ch2, EMIS.none));
  slab(mb, FRAME, -10, 0.1, -2, 2, H - 0.5, H);
  mb.color('#ff8c26').surf(0.8).kind(kindCode(TINT.none, EMIS.interior));
  slab(mb, FRAME, -0.4, 0.02, -1.72, 1.72, 0, 2.85, { top: false, lo: false, hi: false, start: false });
  mb.color('#e24b3b').surf(0.7).kind(kindCode(TINT.ch3, EMIS.none));
  slab(mb, FRAME, 0, 1.55, -1.96, 1.96, 2.85, 3.08);
  mb.color('#1c4566').surf(0.2).kind(kindCode(TINT.none, EMIS.window));
  for (let y = 4.5; y + 2 < H - 0.6; y += 3) slab(mb, FRAME, -0.2, 0.03, -1.4, 1.4, y, y + 1.9, { top: false, lo: false, hi: false, start: false });
}

/** tree: trunk + lumpy canopy (palms: a flat frond crown on a tall trunk) */
function lowTree(t: BakedTemplate, mb: MeshBuilder): void {
  const b = t.bounds;
  const H = b.max.y;
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  const w = Math.min(b.max.x - b.min.x, b.max.z - b.min.z) * 0.46;
  const palm = t.name === 'prop_palm';
  mb.color('#6b4a2e').surf(0.9, MATTE_METAL).kind(kindCode(TINT.none, EMIS.none));
  slab(mb, FRAME, -0.18, 0.18, -0.18, 0.18, 0, H * (palm ? 0.86 : 0.5));
  mb.color('#2f7a35').surf(0.7, MATTE_METAL).kind(kindCode(TINT.sway, EMIS.none));
  if (palm) {
    blob(mb, cx, H * 0.86, cz, w, H * 0.1, w, 8, 2);
    return;
  }
  blob(mb, cx, H * 0.6, cz, w, H * 0.24, w, 9, 3);
  mb.color('#4fa33f');
  blob(mb, cx + w * 0.15, H * 0.74, cz - w * 0.1, w * 0.62, H * 0.2, w * 0.62, 8, 3);
}

const TREES: ReadonlySet<string> = new Set(['prop_raintree', 'prop_palm', 'prop_banana']);

/** a low-detail stand-in for far instances of this template, or null when the full model is cheap enough */
export function lowDetailFor(t: BakedTemplate): BufferGeometry | null {
  const mb = new MeshBuilder();
  if (t.name === 'bld_condo' || t.name === 'bld_office') lowTower(t, mb);
  else if (t.name.startsWith('bld_shophouse')) lowShophouse(t, mb);
  else if (TREES.has(t.name)) lowTree(t, mb);
  else return null;
  return mb.toGeometry('uber');
}
