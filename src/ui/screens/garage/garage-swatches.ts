/**
 * Colour row for one slot (bike paint · helmet · outfit · gear). Colours are shared 'color:*' items: buying one unlocks it
 * for every slot. Picking previews it; a picked locked colour shows an inline buy row under the grid. The gear row is
 * disabled while no gear is fitted.
 */
import type { CatalogItem } from '../../../core/types/save';
import { h } from '../../core/h';
import { swatch, type Swatch } from '../../components/swatch';
import { sectionHead } from '../../components/card';
import { pop } from '../../core/animate';
import { reducedMotion } from '../../core/motion';
import { SLOT, type WearCategory } from '../shop/menu-catalog';
import { confirmBuy, type ConfirmBuy } from '../shop/confirm-buy';
import type { GarageModel } from './garage-model';
import type { GarageBuyHooks } from './garage-items';

export interface SwatchRow {
  el: HTMLElement;
  refresh(model: GarageModel): void;
}

export function swatchRow(cat: WearCategory, colors: readonly CatalogItem[], model: GarageModel, hooks: GarageBuyHooks): SwatchRow {
  const slot = SLOT[cat];
  const picked = h('span.g-swatches__name');
  const swatches: Array<{ item: CatalogItem; sw: Swatch }> = colors.map((item) => ({
    item,
    sw: swatch({ hex: item.hex ?? 'var(--c-white)', name: item.name, onPick: () => model.select(slot.color, item.id) }),
  }));
  /** coins fly into the bought colour's own cell — the buy row folds away the moment the purchase lands */
  const cellOf = (id: string): HTMLElement => swatches.find((s) => s.item.id === id)?.sw.el ?? el;
  const note = h('p.g-swatches__note', '뒷자리 아이템을 고르면 색을 바꿀 수 있어요');
  const buyDot = h('span.g-swatches__dot');
  const buyText = h('span.g-swatches__buy-text');
  const buySlot = h('span.g-swatches__buy-slot');
  const buyRow = h('div.g-swatches__buy', { hidden: true }, buyDot, buyText, buySlot);
  let buyer: { id: string; c: ConfirmBuy } | null = null;
  const el = h(
    'section.g-swatches',
    { aria: { label: slot.colorLabel } },
    sectionHead('Colour', slot.colorLabel, picked),
    note,
    h('div.swatch-grid.g-swatches__grid', swatches.map((s) => s.sw.el)),
    buyRow,
  );

  const refresh = (m: GarageModel): void => {
    const disabled = cat === 'gear' && m.preview.gear === 'none';
    el.classList.toggle('is-disabled', disabled);
    note.hidden = !disabled;
    const current = m.preview[slot.color];
    const worn = m.save.loadout[slot.color];
    let pickedItem: CatalogItem | null = null;
    for (const { item, sw } of swatches) {
      const on = item.id === current;
      if (on) pickedItem = item;
      sw.setSelected(on);
      sw.setLocked(!m.owns(item.id), item.price);
      sw.button.disabled = disabled;
      sw.el.classList.toggle('is-worn', item.id === worn);
    }
    picked.textContent = pickedItem?.name ?? '';
    const locked = !!pickedItem && !m.owns(pickedItem.id) && !disabled;
    if (locked && pickedItem) {
      if (buyer?.id !== pickedItem.id) {
        const item = pickedItem;
        const c = confirmBuy({
          price: item.price,
          affordable: m.save.baht >= item.price,
          size: 'sm',
          onConfirm: (btn) => hooks.buy(item, btn, cellOf(item.id)),
          onDeny: (btn) => hooks.deny(item, btn),
        });
        buyer = { id: item.id, c };
        buySlot.replaceChildren(c.el);
        buyDot.style.setProperty('--swatch', item.hex ?? 'var(--c-white)');
        buyText.replaceChildren(h('b', item.name), h('span', '모든 파츠 공용 색상'));
      }
      buyer.c.setAffordable(m.save.baht >= pickedItem.price);
    }
    if (locked && buyRow.hidden) {
      buyRow.hidden = false;
      pop(buyRow, { from: 0.94 });
      buyRow.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    } else if (!locked) {
      buyRow.hidden = true;
      buyer?.c.disarm();
    }
  };
  refresh(model);
  return { el, refresh };
}
