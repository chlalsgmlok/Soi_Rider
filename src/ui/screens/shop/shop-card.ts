/**
 * One shop tile: art (or a colour dot) · name · one-line description · state (inline buy / 보유 중 / 장착 중).
 * refresh(save) re-derives the state after any purchase; no rebuild of the art.
 */
import type { CatalogItem, SaveData } from '../../../core/types/save';
import { colorHex, STARTER_LOADOUT } from '../../../core/config/catalog';
import { h } from '../../core/h';
import { chip } from '../../components/chip';
import { artKeyFor, itemArt } from './menu-art';
import { bikeLine, isBikeId, itemState, SLOT, type ItemState } from './menu-catalog';
import { confirmBuy, type ConfirmBuy } from './confirm-buy';

export interface ShopCard {
  el: HTMLElement;
  item: CatalogItem;
  /** element coins fly into */
  target: HTMLElement;
  refresh(save: SaveData): void;
  focus(): void;
}

export interface ShopCardHooks {
  buy(item: CatalogItem, pressed: HTMLButtonElement, card: ShopCard): void;
  deny(item: CatalogItem, pressed: HTMLButtonElement): void;
}

const STATE_CHIP: Record<Exclude<ItemState, 'locked'>, { text: string; tone: 'info' | 'good' }> = {
  equipped: { text: '장착 중', tone: 'info' },
  owned: { text: '보유 중', tone: 'good' },
};

function describe(item: CatalogItem): string {
  if (item.category === 'bike' && isBikeId(item.ref)) return bikeLine(item.ref);
  if (item.category === 'color') return '바이크 · 헬멧 · 옷 · 장비 공용';
  return item.desc ?? '';
}

function visual(item: CatalogItem, save: SaveData): HTMLElement {
  if (item.category === 'color') return h('span.shop-card__dot', { style: { '--swatch': item.hex ?? 'var(--c-white)' } });
  const key = artKeyFor(item);
  const cat = item.category === 'fuel' ? null : item.category;
  const hex = colorHex(cat ? save.loadout[SLOT[cat].color] : STARTER_LOADOUT.bikeColor);
  return key ? itemArt(key, hex, 'lg').el : h('span.menu-art.menu-art--lg');
}

export function shopCard(item: CatalogItem, save: SaveData, hooks: ShopCardHooks): ShopCard {
  const art = visual(item, save);
  const stateSlot = h('div.shop-card__state');
  const el = h(
    'article.shop-card',
    { class: `shop-card--${item.category}`, data: { item: item.id }, aria: { label: `${item.name} ${item.price}바트` } },
    h('div.shop-card__art', art),
    h('h3.shop-card__name', item.name),
    h('p.shop-card__desc', describe(item)),
    stateSlot,
  );
  let state: ItemState | null = null;
  let buyer: ConfirmBuy | null = null;
  const api: ShopCard = {
    el,
    item,
    target: art,
    refresh(next) {
      const s = itemState(next, item);
      if (s === 'locked' && buyer) buyer.setAffordable(next.baht >= item.price);
      if (s === state) return;
      state = s;
      el.classList.toggle('is-locked', s === 'locked');
      el.classList.toggle('is-owned', s !== 'locked');
      el.tabIndex = s === 'locked' ? -1 : 0; // owned cards stay browsable with the arrows; locked ones focus their buy button
      if (s === 'locked') {
        buyer = confirmBuy({
          price: item.price,
          affordable: next.baht >= item.price,
          size: 'sm',
          block: true,
          onConfirm: (btn) => hooks.buy(item, btn, api),
          onDeny: (btn) => hooks.deny(item, btn),
        });
        stateSlot.replaceChildren(buyer.el);
      } else {
        buyer = null;
        const c = STATE_CHIP[s];
        stateSlot.replaceChildren(chip({ text: c.text, tone: c.tone, icon: s === 'equipped' ? 'check' : 'unlock', size: 'sm', solid: s === 'equipped' }));
      }
    },
    focus() {
      (el.querySelector<HTMLElement>('button') ?? el).focus({ preventScroll: false });
    },
  };
  api.refresh(save);
  return api;
}
