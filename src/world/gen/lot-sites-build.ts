import { PALETTE } from '../../core/config/palette';
import type { LotInfo } from './lot-landmarks';
import type { LotKit } from './lot-kit';

/** authored footprint (square) of each tower model */
export const TOWER_SIZE = { bld_condo: 16, bld_office: 20 } as const;
export type TowerAssetName = keyof typeof TOWER_SIZE;
/** forecourt depth in front of a tower and clearance behind it */
export const TOWER_SETBACK = 6;
export const TOWER_BACK = 3;

/** lot size a tower of this model and scale needs (width, depth) */
export function towerLot(asset: TowerAssetName, scale: number): [number, number] {
  const f = TOWER_SIZE[asset] * scale;
  return [f + 8, f + TOWER_SETBACK + TOWER_BACK];
}

/**
 * Condo / office / hotel tower on a paved forecourt: driveway gap in the front fence, a spirit house in the
 * front corner (every Bangkok tower has one), palms and pot plants.
 */
export function buildTower(K: LotKit, asset: TowerAssetName, scale: number, kind: string, info: LotInfo): boolean {
  const { width: W, depth: D } = K.L;
  const f = TOWER_SIZE[asset] * scale;
  const col = K.building(-f / 2, f / 2, TOWER_SETBACK, TOWER_SETBACK + f);
  if (col < 0) return false;
  K.plaza(-W / 2, W / 2, 0, D);
  const meta = K.anchorMeta('tower', { kind, ...(info.sign ? { sign: info.sign } : {}), ...(info.poi ? { poi: info.poi } : {}) });
  K.model(asset, 0, TOWER_SETBACK, scale, col, meta);
  const drive = K.ctx.rng.chance(0.5) ? -1 : 1;
  K.fence(drive > 0 ? 0.5 : -W / 2 + 1.5, drive > 0 ? W / 2 - 1.5 : -0.5, 'tower');
  K.prop('prop_spirit_house', -drive * (W / 2 - 1.6), 1.8, 0, 1, undefined, { kind: 'tower' });
  for (const u of [-f / 2 + 1, f / 2 - 1]) K.prop('prop_pot_plant', u, TOWER_SETBACK - 1);
  K.prop('prop_palm', -drive * (W / 2 - 1.5), D - 1.5, 0, 1.1);
  K.prop('prop_palm', drive * (W / 2 - 1.5), D - 1.5, 0, 1.0);
  return true;
}

const MARKET_FOODS = ['ผัดไทย', 'ส้มตำ', 'หมูปิ้ง', 'ไก่ทอด', 'ผลไม้', 'ข้าวเหนียวมะม่วง', 'ก๋วยเตี๋ยว', 'น้ำปั่น', 'ขนมครก', 'ลูกชิ้น'];

/** open-air night market: two facing rows of carts with umbrellas, tables and stools down the middle aisle */
export function buildMarket(K: LotKit, info: LotInfo): boolean {
  const { width: W, depth: D } = K.L;
  const { rng } = K.ctx;
  K.plaza(-W / 2, W / 2, 0, D);
  const umbrellas = [PALETTE.awningRed, PALETTE.awningGreen, PALETTE.awningBlue, PALETTE.taxiOrange];
  const meta = K.anchorMeta('market', { ...(info.poi ? { poi: info.poi } : {}), ...(info.poiTh ? { sign: info.poiTh } : {}) });
  K.model('prop_umbrella', -W / 2 + 1.2, 1.2, 1.1, null, { ...meta, color: rng.pick(umbrellas) });
  for (const [v, turn] of [[3.2, 0], [D - 3.2, Math.PI]] as const) {
    for (let u = -W / 2 + 3; u <= W / 2 - 3; u += 3.4) {
      const food = rng.pick(MARKET_FOODS);
      if (!K.prop('prop_food_cart', u, v, turn, 1, undefined, { text: food, paint: rng.pick(umbrellas) })) continue;
      K.prop('prop_umbrella', u + 1.3, v + (turn ? -1.1 : 1.1), 0, 1, undefined, { color: rng.pick(umbrellas) });
    }
  }
  for (let u = -W / 2 + 3; u <= W / 2 - 3; u += 3.2) {
    const v = D / 2 + rng.range(-1, 1);
    if (!K.prop('prop_table', u, v, rng.range(0, 3))) continue;
    for (const [du, dv] of [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]]) {
      if (rng.chance(0.8)) K.prop('prop_stool', u + du, v + dv, 0, 1, undefined, { color: rng.pick([PALETTE.taxiRed, PALETTE.taxiBlue]) });
    }
  }
  K.prop('prop_ice_box', W / 2 - 1.2, D / 2 + 2.4);
  K.prop('prop_crates', -W / 2 + 1.2, D / 2 - 2.4);
  return true;
}
