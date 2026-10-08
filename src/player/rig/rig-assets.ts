import { CATALOG } from '../../core/config/catalog';
import type { PassengerLook } from '../../core/types';
import { OUTFIT_ASSET } from './loadout';
import { SPARE_HELMET } from './passenger';

/** every hair / hat a PassengerLook can ask for */
const PASSENGER_HAIR: readonly PassengerLook['hair'][] = ['hair_short', 'hair_long', 'hair_bun', 'hat_cap'];

/**
 * Every model a RiderRig (with its passenger) may instance: the rider body, all catalog bikes, helmets, outfit
 * overlays and gear, plus the passenger's hair / cap, spare helmet, poncho and mask. `Assets.preload` these before
 * building a RiderRig or changing its loadout.
 */
export function riderRigAssetNames(): string[] {
  const names = new Set<string>(['char_body', SPARE_HELMET.asset, 'outfit_poncho', 'acc_mask', ...PASSENGER_HAIR]);
  for (const item of CATALOG) {
    if (!item.ref) continue;
    if (item.category === 'bike') names.add(`bike_${item.ref}`);
    else if (item.category === 'helmet') names.add(item.ref);
    else if (item.category === 'gear' && item.ref !== 'none') names.add(item.ref);
  }
  for (const asset of Object.values(OUTFIT_ASSET)) if (asset) names.add(asset);
  return [...names];
}
