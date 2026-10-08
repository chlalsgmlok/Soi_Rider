import { CATALOG } from '../../../core/config/catalog';
import type { GearId, HelmetId, Loadout, OutfitId } from '../../../core/types';
import type { Assets } from '../../../engine/assets/assets';
import type { Engine } from '../../../engine/engine';
import { GarageScene } from '../garage/garage-scene';
import { cycle, type Harness, param } from './harness';
import { demoSave, showGarageUi } from './ui-overlay';

const BIKES: readonly Loadout['bike'][] = ['cub', 'scooter', 'sport'];
const HELMETS: readonly HelmetId[] = ['helmet_open', 'helmet_full', 'helmet_half', 'helmet_cat'];
const OUTFITS: readonly OutfitId[] = ['tee', 'win_vest', 'hoodie', 'track_jacket', 'aloha'];
const GEARS: readonly GearId[] = ['none', 'gear_topbox', 'gear_bag', 'gear_rack', 'gear_cushion', 'gear_backrest', 'gear_throne'];
const COLORS = CATALOG.filter((c) => c.category === 'color').map((c) => c.id);

/**
 * garage: ?bike= &helmet= &outfit= &gear= &yaw=<rad> &reduced=1 &ui=1 (the real garage screen, wired to the scene)
 * keys ← → rotate (like the drag surface) · E equip the next look · B next bike · M reduced motion
 */
export async function garageHarness(engine: Engine, assets: Assets, qs: URLSearchParams, base: Loadout,
  progress: (text: string) => void): Promise<Harness> {
  const pick = <T extends string>(k: string, list: readonly T[], d: T): T => list.find((v) => v === qs.get(k)) ?? d;
  let look: Loadout = {
    ...base, bike: pick('bike', BIKES, base.bike), helmet: pick('helmet', HELMETS, base.helmet),
    outfit: pick('outfit', OUTFITS, base.outfit), gear: pick('gear', GEARS, base.gear),
  };
  let reduced = qs.get('reduced') === '1';
  let looks = 0;
  const garage = await GarageScene.create(engine, assets, { loadout: look, reducedMotion: reduced },
    (d, t, n) => progress(`loading ${d}/${t} · ${n}`));
  if (qs.has('yaw')) garage.rotate(param(qs, 'yaw', 0));
  if (qs.get('ui') === '1') showGarageUi(demoSave(look), garage);
  const equip = (next: Loadout): void => {
    look = next;
    garage.applyLoadout(look);
  };
  return {
    scene: garage,
    key(code) {
      if (code === 'ArrowLeft' || code === 'ArrowRight') garage.rotate(code === 'ArrowRight' ? 0.35 : -0.35);
      else if (code === 'KeyB') equip({ ...look, bike: cycle(BIKES, look.bike) });
      else if (code === 'KeyE') {
        looks++;
        equip({
          ...look, helmet: cycle(HELMETS, look.helmet), outfit: cycle(OUTFITS, look.outfit), gear: cycle(GEARS, look.gear),
          bikeColor: COLORS[(looks * 5) % COLORS.length], helmetColor: COLORS[(looks * 3 + 1) % COLORS.length],
          outfitColor: COLORS[(looks * 7 + 2) % COLORS.length], gearColor: COLORS[(looks + 4) % COLORS.length],
        });
      } else if (code === 'KeyM') garage.reducedMotion = reduced = !reduced;
      else return false;
      return true;
    },
    info: () => `garage · ${look.bike} · ${look.helmet} · ${look.outfit} · ${look.gear}${reduced ? ' · reduced' : ''}`,
    stats: () => ({ look }),
  };
}
