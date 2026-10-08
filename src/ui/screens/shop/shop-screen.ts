/**
 * Shop (ShopProps): a Bangkok market stall — striped awning, fuel bottle rack on the left, catalog grid by category on the
 * right. Purchases are inline two-step buttons; success flies coins from the ฿ wallet into the item (fuel tokens fly back
 * into the ⛽ wallet), failure shakes + plays 'deny'. Esc cancels an armed purchase first, then calls onBack.
 */
import './shop.css';
import type { CatalogItem } from '../../../core/types/save';
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { stagger } from '../../core/animate';
import { menuWallets } from './menu-wallets';
import { menuHeader } from './menu-header';
import { itemsOf } from './menu-catalog';
import { denyPurchase, playPurchase, soldStamp, type PurchaseFx } from './purchase-fx';
import { disarmWithin, isTyping } from './menu-keys';
import { fuelSection } from './shop-fuel';
import { shopGrid } from './shop-grid';
import type { ShopCard, ShopCardHooks } from './shop-card';

export function mountShop(ctx: ScreenContext<'shop'>): ScreenView<'shop'> {
  const p = ctx.props();
  let save = p.save;
  let flights = 0;
  const wallets = menuWallets(save);
  const fx: PurchaseFx = { ui: ctx.ui, wallets };

  const bought = (item: CatalogItem, card: ShopCard): void => {
    if (item.category === 'fuel') {
      soldStamp(card.el, `연료 +${item.amount ?? 1}`);
      ctx.ui.toast(`${item.name} 충전 완료 · 연료 ${save.fuel}회`, 'good', 'fuel');
    } else {
      soldStamp(card.el);
      ctx.ui.toast(`${item.name} 구매 완료 — 차고에서 장착해 보세요`, 'good', 'cart');
    }
  };

  const hooks: ShopCardHooks = {
    buy(item, pressed, card) {
      flights++; // raised before onBuy: the app may push handle.update({ save }) synchronously
      const res = ctx.props().onBuy(item.id);
      if (res.ok) {
        save = res.save;
        refresh();
        bought(item, card);
        card.focus();
      }
      void playPurchase(fx, item, res, card.target, pressed).finally(() => {
        flights--;
        if (!flights) wallets.set(save);
      });
    },
    deny: (item, pressed) => denyPurchase(fx, item, pressed, 'funds', save.baht),
  };

  const fuel = fuelSection(itemsOf(p.catalog, 'fuel'), save, hooks);
  const grid = shopGrid(p.catalog, save, hooks);
  const refresh = (): void => {
    fuel.refresh(save);
    grid.refresh(save);
  };
  const header = menuHeader({
    plate: { th: 'ร้านค้า', en: 'Shop', no: '23' },
    title: '상점',
    sub: '꾸미기 아이템과 연료 · 구매한 아이템은 차고에서 장착',
    onBack: () => ctx.props().onBack(),
    right: wallets.el,
  });
  const panel = h(
    'div.shop__panel',
    h('div.shop__awning', { aria: { hidden: true } }),
    h('div.shop__head', header),
    h('div.shop__body', h('aside.shop__fuel', fuel.el), h('div.shop__catalog', grid.el)),
  );
  ctx.el.append(h('div.menu-stage', h('div.shop', panel)));

  return {
    enter() {
      stagger([header, fuel.el, grid.el], { step: 70 });
    },
    update(props, changed) {
      if (!changed.save || props.save === save) return;
      save = props.save;
      refresh();
      if (!flights) wallets.set(save);
    },
    key: (e) => !isTyping() && grid.tabs.handleKey(e),
    back() {
      if (disarmWithin(ctx.el)) return true;
      ctx.props().onBack();
      return true;
    },
    destroy: () => grid.dispose(),
  };
}
