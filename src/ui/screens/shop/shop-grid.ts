/**
 * Shop catalog: category tabs (오토바이 · 헬멧 · 옷 · 장비 · 색상) over a grid of shop cards. Q/E switch tabs (forward
 * the screen's key() to handleKey). Every pane is built once; refresh(save) only updates card states and the owned count.
 */
import type { CatalogItem, ItemCategory, SaveData } from '../../../core/types/save';
import { h } from '../../core/h';
import { tabStrip, type TabStrip } from '../../components/tab-strip';
import { stagger } from '../../core/animate';
import { CATEGORY, itemsOf, itemState } from './menu-catalog';
import { shopCard, type ShopCard, type ShopCardHooks } from './shop-card';

export type ShopTab = Exclude<ItemCategory, 'fuel'>;
const TABS: readonly ShopTab[] = ['bike', 'helmet', 'outfit', 'gear', 'color'];

export interface ShopGrid {
  el: HTMLElement;
  tabs: TabStrip<ShopTab>;
  cards: ShopCard[];
  refresh(save: SaveData): void;
  dispose(): void;
}

export function shopGrid(catalog: readonly CatalogItem[], save: SaveData, hooks: ShopCardHooks, initial: ShopTab = 'bike'): ShopGrid {
  const cards: ShopCard[] = [];
  const counts = new Map<ShopTab, HTMLElement>();
  const panes = new Map<ShopTab, HTMLElement>();
  for (const tab of TABS) {
    const items = itemsOf(catalog, tab);
    const tabCards = items.map((it) => shopCard(it, save, hooks));
    cards.push(...tabCards);
    const count = h('span.shop-pane__count.t-num');
    counts.set(tab, count);
    panes.set(
      tab,
      h(
        'section.shop-pane',
        { data: { pane: tab }, hidden: tab !== initial, role: 'tabpanel', aria: { label: CATEGORY[tab].label } },
        h('div.shop-pane__head', h('span.shop-pane__kicker', CATEGORY[tab].en), h('h2.shop-pane__title', CATEGORY[tab].label), h('span.u-grow'), count),
        h('div.shop-pane__grid', { class: `shop-pane__grid--${tab}` }, tabCards.map((c) => c.el)),
      ),
    );
  }

  const body = h('div.shop-grid__body.scroll-y', [...panes.values()]);
  const show = (tab: ShopTab): void => {
    for (const [id, pane] of panes) pane.hidden = id !== tab;
    body.scrollTop = 0;
    const grid = panes.get(tab)?.querySelector('.shop-pane__grid');
    if (grid) stagger(grid.children, { step: 28, delay: 0, distance: 8 });
  };
  const tabs = tabStrip<ShopTab>({
    tabs: TABS.map((id) => ({ id, label: CATEGORY[id].label, icon: CATEGORY[id].icon })),
    active: initial,
    block: true,
    label: '상점 카테고리',
    onChange: show,
  });
  const el = h('div.shop-grid', h('div.shop-grid__tabs', tabs.el, h('span.shop-grid__hint', h('span.keycap.keycap--sm', 'Q'), h('span.keycap.keycap--sm', 'E'))), body);

  const refresh = (next: SaveData): void => {
    cards.forEach((c) => c.refresh(next));
    for (const tab of TABS) {
      const items = itemsOf(catalog, tab);
      const owned = items.filter((it) => itemState(next, it) !== 'locked').length;
      const el = counts.get(tab);
      if (el) el.textContent = `${owned}/${items.length} 보유`;
    }
  };
  refresh(save);
  return { el, tabs, cards, refresh, dispose: () => tabs.dispose() };
}
