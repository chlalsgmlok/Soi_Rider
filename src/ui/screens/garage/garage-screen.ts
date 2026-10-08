/**
 * Garage (GarageProps): right-docked panel (≤ 460 px) over a transparent left side where the 3D turntable lives —
 * dragging there calls onRotate. Tabs 오토바이 · 헬멧 · 옷 · 장비 · 닉네임 (Q/E); every pick previews live (onPreview),
 * locked picks unfold inline purchases, the footer equips (onEquip). Leaving equips owned changes automatically.
 */
import './garage.css';
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { tabStrip, type TabDef } from '../../components/tab-strip';
import { sectionHead } from '../../components/card';
import { slideIn, stagger } from '../../core/animate';
import { CATEGORY, WEAR_CATEGORIES, itemsOf, type WearCategory } from '../shop/menu-catalog';
import { menuWallets } from '../shop/menu-wallets';
import { menuHeader } from '../shop/menu-header';
import { disarmWithin, isTyping } from '../shop/menu-keys';
import { GarageModel } from './garage-model';
import { itemList } from './garage-items';
import { swatchRow } from './garage-swatches';
import { bikeStats } from './garage-stats';
import { nicknameEditor } from './garage-nickname';
import { garageFooter } from './garage-footer';
import { garageActions } from './garage-actions';
import { showcase } from './garage-showcase';
import { turntable } from './garage-turntable';

type Tab = WearCategory | 'nickname';
const TABS: TabDef<Tab>[] = [
  ...WEAR_CATEGORIES.map((id) => ({ id, label: CATEGORY[id].label, icon: CATEGORY[id].icon })),
  { id: 'nickname', label: '닉네임', icon: 'user' },
];

export function mountGarage(ctx: ScreenContext<'garage'>): ScreenView<'garage'> {
  const p = ctx.props();
  const model = new GarageModel(p.save);
  const wallets = menuWallets(p.save);
  const show = showcase(model);
  const turn = turntable((d) => ctx.props().onRotate(d));
  const footHolder: { target: HTMLElement | null } = { target: null };
  const act = garageActions(ctx, model, { ui: ctx.ui, wallets }, () => footHolder.target ?? ctx.el, () => show.celebrate());

  const refreshers: Array<(m: GarageModel) => void> = [];
  const panes = new Map<Tab, HTMLElement>();
  const colors = itemsOf(p.catalog, 'color');
  let stick: HTMLElement | null = null;
  for (const cat of WEAR_CATEGORIES) {
    const list = itemList(cat, itemsOf(p.catalog, cat), model, act);
    const swatches = swatchRow(cat, colors, model, act);
    const stats = cat === 'bike' ? bikeStats(model) : null;
    if (stats) stick = h('div.g-stick', stats.el);
    refreshers.push(list.refresh, swatches.refresh, ...(stats ? [stats.refresh] : []));
    const head = sectionHead('Model', cat === 'bike' ? '모델' : `${CATEGORY[cat].label} 고르기`);
    panes.set(cat, h('div.g-pane', { data: { pane: cat }, hidden: cat !== 'bike', role: 'tabpanel' }, stats ? stick : null, head, list.el, swatches.el));
  }
  const nick = nicknameEditor(model, {
    submit: () => {
      // Enter equips — unless unbought previews are pending (equipping would silently drop them)
      if (!model.unowned().length) return act.equip();
      ctx.ui.toast('미보유 아이템을 구매하거나 되돌린 뒤 장착할 수 있어요', 'warn', 'cart');
      footHolder.target?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    },
  });
  panes.set('nickname', h('div.g-pane', { data: { pane: 'nickname' }, hidden: true, role: 'tabpanel' }, nick.el));

  const leave = (go: () => void): void => {
    act.settle();
    go();
  };
  const footer = garageFooter(model, {
    shop: () => leave(() => ctx.props().onShop()),
    revert: () => model.revert(),
    equip: () => act.equip(),
    buyAll: (btn) => act.buyAll(btn),
    denyAll: (btn) => act.denyAll(btn),
  });
  footHolder.target = footer.target;
  refreshers.push(nick.refresh, footer.refresh, show.refresh);

  const body = h('div.g-body.scroll-y', [...panes.values()]);
  if (stick) {
    // the spec bars stay pinned while bikes scroll beneath them; scroll-padding keeps revealed buy rows clear of them
    const pinned = stick;
    const ro = new ResizeObserver(() => body.style.setProperty('--g-stick', `${pinned.offsetHeight}px`));
    ro.observe(pinned);
    ctx.onDispose(() => ro.disconnect());
  }
  const tabs = tabStrip<Tab>({
    tabs: TABS,
    active: 'bike',
    block: true,
    label: '차고 탭',
    onChange: (id) => {
      for (const [k, pane] of panes) pane.hidden = k !== id;
      body.scrollTop = 0;
      const pane = panes.get(id);
      if (pane) stagger(pane.children, { step: 40, delay: 0, distance: 10 });
    },
  });
  const header = menuHeader({
    plate: { th: 'โรงรถ', en: 'Garage' },
    title: '차고',
    sub: '라이더 꾸미기',
    onBack: () => leave(() => ctx.props().onBack()),
    right: wallets.el,
  });
  const panel = h('aside.g-panel', { aria: { label: '차고' } }, h('div.g-panel__head', header, h('div.g-tabs', tabs.el)), body, footer.el);
  ctx.el.append(h('div.menu-stage', h('div.garage', turn.el, show.el, show.hint, panel)));

  let lastPreview = model.preview;
  const off = model.on(() => {
    for (const fn of refreshers) fn(model);
    if (model.preview !== lastPreview) {
      lastPreview = model.preview;
      ctx.props().onPreview(model.preview);
    }
  });

  return {
    enter() {
      slideIn(panel, 'right', { distance: 48 });
      slideIn(show.el, 'left', { distance: 24, delay: 120 });
      const first = panes.get('bike');
      if (first) stagger(first.children, { step: 50, delay: 140, distance: 10 });
    },
    update(next, changed) {
      if (!changed.save || next.save === model.save) return;
      model.setSave(next.save);
      if (!act.busy()) wallets.set(next.save);
    },
    key(e) {
      if (isTyping()) return false;
      return tabs.handleKey(e) || turn.key(e);
    },
    back() {
      if (disarmWithin(ctx.el)) return true;
      if (isTyping()) {
        nick.input.blur();
        return true;
      }
      leave(() => ctx.props().onBack());
      return true;
    },
    destroy() {
      // closed by the app without back / 상점: still equip owned changes and restore the previewed look
      act.settle(true);
      off();
      tabs.dispose();
      turn.dispose();
    },
  };
}
