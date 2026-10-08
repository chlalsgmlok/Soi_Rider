/**
 * Garage commands: buy one item (card / swatch), buy every missing item then equip (footer), equip, and settle on leave
 * (owned changes are equipped automatically, unbought previews are dropped and the 3D preview is restored).
 */
import type { CatalogItem } from '../../../core/types/save';
import type { BuyResult } from '../../../core/types/screens';
import type { ScreenContext } from '../../core/screen-types';
import { LOADOUT_SLOTS } from '../../../logic/loadout-items';
import { denyPurchase, playPurchase, soldStamp, type PurchaseFx } from '../shop/purchase-fx';
import type { GarageModel } from './garage-model';

export interface GarageActions {
  buy(item: CatalogItem, pressed: HTMLButtonElement, target: HTMLElement): void;
  deny(item: CatalogItem, pressed: HTMLButtonElement): void;
  buyAll(pressed: HTMLButtonElement): void;
  denyAll(pressed: HTMLButtonElement): void;
  equip(): void;
  /** call before leaving the garage (quiet: no toast — the garage is being torn down); a no-op once settled */
  settle(quiet?: boolean): void;
  /** a purchase animation is still running (wallets are being animated) */
  busy(): boolean;
}

export function garageActions(ctx: ScreenContext<'garage'>, model: GarageModel, fx: PurchaseFx, footTarget: () => HTMLElement, onEquipped: () => void): GarageActions {
  let flights = 0;
  /** raise BEFORE calling onBuy (the app may push handle.update({ save }) synchronously); fly() lowers it on landing */
  const raise = (): void => {
    flights++;
  };
  const fly = (item: CatalogItem, res: BuyResult, target: HTMLElement, pressed: HTMLElement): void => {
    void playPurchase(fx, item, res, target, pressed).finally(() => {
      flights--;
      if (!flights) fx.wallets.set(model.save);
    });
  };

  const equip = (): void => {
    const saved = ctx.props().onEquip(model.preview);
    model.commit(saved);
    ctx.ui.sfx('equip');
    ctx.ui.toast('장착 완료! 오늘도 안전 운행', 'good', 'helmet');
    onEquipped();
  };

  const denyAll = (pressed: HTMLButtonElement): void => {
    const missing = model.unowned();
    const total = missing.reduce((s, it) => s + it.price, 0);
    const bundle: CatalogItem = { id: 'bundle', category: 'color', name: '미보유 아이템', price: total, starter: false };
    denyPurchase(fx, bundle, pressed, 'funds', model.save.baht);
  };

  return {
    buy(item, pressed, target) {
      raise();
      const res = ctx.props().onBuy(item.id);
      if (res.ok) {
        model.setSave(res.save);
        // the inline buy row folds away; keep keyboard focus on the bought card / colour
        target.querySelector<HTMLElement>('.g-item__pick, .swatch')?.focus({ preventScroll: true });
        soldStamp(target);
        ctx.ui.toast(`${item.name} 구매 완료 · 장착하기로 저장하세요`, 'good', 'cart');
      }
      fly(item, res, target, pressed);
    },
    deny: (item, pressed) => denyPurchase(fx, item, pressed, 'funds', model.save.baht),
    buyAll(pressed) {
      const missing = model.unowned();
      const total = missing.reduce((s, it) => s + it.price, 0);
      if (!missing.length) return equip();
      if (model.save.baht < total) return denyAll(pressed);
      let last: BuyResult | null = null;
      raise();
      for (const item of missing) {
        const res = ctx.props().onBuy(item.id);
        if (!res.ok) {
          fly(item, res, footTarget(), pressed);
          return;
        }
        last = res;
        model.setSave(res.save);
      }
      if (!last) {
        flights--;
        return;
      }
      fly({ ...missing[0], name: `${missing.length}개 아이템`, price: total }, last, footTarget(), pressed);
      equip();
    },
    denyAll,
    equip,
    settle(quiet = false) {
      if (!model.dirty()) return;
      const dropped = model.unowned().length;
      const saved = model.save.loadout;
      const owned = model.ownedOnly();
      const keep = { ...owned, nickname: owned.nickname.trim() || saved.nickname };
      const changed = LOADOUT_SLOTS.some((s) => keep[s] !== saved[s]) || keep.nickname !== saved.nickname;
      // both paths reset the preview to the saved loadout, and the screen's model listener sends it to onPreview
      if (changed) model.commit(ctx.props().onEquip(keep));
      else model.revert();
      if (quiet) return;
      if (changed) ctx.ui.toast(dropped ? '미보유 아이템은 빼고 장착했어요' : '변경 사항을 장착했어요', 'info', 'check');
      else ctx.ui.toast('구매하지 않은 미리보기는 되돌렸어요', 'info', 'refresh');
    },
    busy: () => flights > 0,
  };
}
