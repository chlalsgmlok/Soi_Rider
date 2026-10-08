/**
 * Item cards for one wearable category. Each card: painted mini art · name · state (장착 중 / 보유 / ฿price).
 * Picking a card previews it (onPreview through the model); a picked locked card unfolds an inline two-step buy row.
 * Bikes render as wide rows with their description, the other categories as a 2-column tile grid.
 */
import { colorHex } from '../../../core/config/catalog';
import type { CatalogItem } from '../../../core/types/save';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { pop } from '../../core/animate';
import { reducedMotion } from '../../core/motion';
import { artKeyFor, itemArt, type ItemArt } from '../shop/menu-art';
import { SLOT, type WearCategory } from '../shop/menu-catalog';
import { confirmBuy, type ConfirmBuy } from '../shop/confirm-buy';
import type { GarageModel } from './garage-model';

export interface GarageBuyHooks {
  buy(item: CatalogItem, pressed: HTMLButtonElement, target: HTMLElement): void;
  deny(item: CatalogItem, pressed: HTMLButtonElement): void;
}

interface Card {
  item: CatalogItem;
  el: HTMLElement;
  pick: HTMLButtonElement;
  art: ItemArt | null;
  state: HTMLElement;
  buyRow: HTMLElement;
  buyer: ConfirmBuy | null;
}

export interface ItemList {
  el: HTMLElement;
  refresh(model: GarageModel): void;
}

type StateKey = 'equipped' | 'owned' | 'locked';

function stateLine(key: StateKey, item: CatalogItem): Array<Node | string> {
  if (key === 'equipped') return [icon('check', 14), '장착 중'];
  if (key === 'owned') return ['보유'];
  return [h('span.coin'), h('span.t-num', item.price.toLocaleString('en-US'))];
}

export function itemList(cat: WearCategory, items: readonly CatalogItem[], model: GarageModel, hooks: GarageBuyHooks): ItemList {
  const slot = SLOT[cat];
  const wide = cat === 'bike';
  const cards: Card[] = items.map((item) => {
    const key = artKeyFor(item);
    const art = key ? itemArt(key, colorHex(model.preview[slot.color]), wide ? 'lg' : 'md') : null;
    const state = h('span.g-item__state');
    const pick = h(
      'button.g-item__pick',
      { type: 'button', data: { sfx: 'tap' }, aria: { label: `${item.name}${item.price ? ` · ${item.price}바트` : ''}` }, on: { click: () => model.select(slot.item, item.ref ?? '') } },
      art?.el ?? null,
      h('span.g-item__text', h('span.g-item__name', item.name), wide && item.desc ? h('span.g-item__desc', item.desc) : null,
        item.perk ? h('span.g-item__perk', { title: item.desc ?? '' }, `승차감 +${item.perk.start}`) : null, state),
    );
    const buyRow = h('div.g-item__buy', { hidden: true });
    const el = h('div.g-item', { class: wide ? 'g-item--row' : 'g-item--tile', data: { item: item.id } }, pick, buyRow);
    return { item, el, pick, art, state, buyRow, buyer: null };
  });

  const refresh = (m: GarageModel): void => {
    const hex = colorHex(m.preview[slot.color]);
    const worn = `${cat}:${m.save.loadout[slot.item]}`;
    const picked = `${cat}:${m.preview[slot.item]}`;
    for (const c of cards) {
      const selected = c.item.id === picked;
      const equipped = c.item.id === worn;
      const locked = !m.owns(c.item.id);
      c.art?.setColor(hex);
      c.el.classList.toggle('is-selected', selected);
      c.el.classList.toggle('is-equipped', equipped);
      c.el.classList.toggle('is-locked', locked);
      c.pick.setAttribute('aria-pressed', String(selected));
      const key: StateKey = equipped ? 'equipped' : locked ? 'locked' : 'owned';
      if (c.state.dataset.state !== key) {
        c.state.dataset.state = key;
        c.state.replaceChildren(...stateLine(key, c.item));
      }
      const showBuy = selected && locked;
      if (showBuy && !c.buyer) {
        const buyer = confirmBuy({
          price: c.item.price,
          affordable: m.save.baht >= c.item.price,
          label: '구매',
          size: 'sm',
          block: true,
          onConfirm: (btn) => hooks.buy(c.item, btn, c.el),
          onDeny: (btn) => hooks.deny(c.item, btn),
        });
        c.buyer = buyer;
        c.buyRow.replaceChildren(buyer.el);
      }
      c.buyer?.setAffordable(m.save.baht >= c.item.price);
      if (showBuy && c.buyRow.hidden) {
        c.buyRow.hidden = false;
        pop(c.buyRow, { from: 0.92 });
        c.buyRow.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      } else if (!showBuy) {
        c.buyRow.hidden = true;
        c.buyer?.disarm();
      }
    }
  };
  refresh(model);
  return { el: h('div.g-items', { class: wide ? 'g-items--rows' : 'g-items--tiles' }, cards.map((c) => c.el)), refresh };
}
