import { CATALOG } from '../../core/config/catalog';
import type { BuyResult } from '../../core/types';
import { buy, equip } from '../../logic';
import { reducedMotion } from '../../ui';
import type { AppCtx } from '../app-context';
import { menuAmbience } from './menu-ambience';

/** buy through the economy and persist; the menus share it */
export function buyItem(ctx: AppCtx, itemId: string): BuyResult {
  const res = buy(ctx.saves.save, itemId);
  if (res.ok) ctx.saves.commit(res.save);
  return res;
}

/**
 * GARAGE: the rider on the shophouse turntable left, the garage panel docked right. Previews re-dress the 3D rider
 * live, 장착하기 persists the loadout (the title hero wears it too), locked items can be bought in place.
 */
export async function showGarage(ctx: AppCtx): Promise<void> {
  const garage = await ctx.backdrops.loadGarage(ctx.saves.save.loadout, reducedMotion());
  ctx.ui.show('garage', {
    save: ctx.saves.save,
    catalog: CATALOG,
    onPreview: (l) => garage.applyLoadout(l),
    onEquip: (l) => {
      const next = ctx.saves.commit(equip(ctx.saves.save, l));
      ctx.backdrops.setLoadout(next.loadout);
      return next;
    },
    onBuy: (id) => buyItem(ctx, id),
    onBack: () => ctx.nav.title(),
    onShop: () => ctx.nav.shop(() => ctx.nav.garage()),
    onRotate: (d) => garage.rotate(d),
  }, 'wipe', {
    onCovered: () => {
      ctx.endSession();
      garage.applyLoadout(ctx.saves.save.loadout);
      ctx.showBackdrop(garage);
      ctx.state = 'garage';
      ctx.music('garage');
      menuAmbience(ctx.audio, 'garage');
    },
  });
}

/** SHOP: the catalog as a purchase grid (fuel packs too) over the current backdrop */
export function showShop(ctx: AppCtx, back: () => void): void {
  ctx.ui.show('shop', { save: ctx.saves.save, catalog: CATALOG, onBuy: (id) => buyItem(ctx, id), onBack: back }, 'wipe', {
    onCovered: () => {
      ctx.state = 'shop';
      ctx.music('garage');
    },
  });
}
