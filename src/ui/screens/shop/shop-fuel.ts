/**
 * Fuel packs (game credits): bottle-rack art · "연료 5회" · per-trip price + saving vs the single bottle · inline buy.
 * fuelPackRow() is reused by the Setup screen's out-of-fuel strip; fuelSection() is the Shop's left column.
 */
import type { CatalogItem, SaveData } from '../../../core/types/save';
import { h } from '../../core/h';
import { chip } from '../../components/chip';
import { sectionHead } from '../../components/card';
import { fmtBaht } from '../../core/count-up';
import { fuelArt } from './menu-art';
import { confirmBuy } from './confirm-buy';
import type { ShopCard, ShopCardHooks } from './shop-card';

const perTrip = (p: CatalogItem): number => p.price / Math.max(1, p.amount ?? 1);

/** id of the pack with the lowest price per trip */
export function bestValueId(packs: readonly CatalogItem[]): string | null {
  return packs.reduce<CatalogItem | null>((best, p) => (!best || perTrip(p) < perTrip(best) ? p : best), null)?.id ?? null;
}

export function fuelPackRow(pack: CatalogItem, save: SaveData, packs: readonly CatalogItem[], hooks: ShopCardHooks, compact = false): ShopCard {
  const base = Math.max(...packs.map(perTrip));
  const saving = Math.round((1 - perTrip(pack) / base) * 100);
  const best = bestValueId(packs) === pack.id && packs.length > 1;
  const art = fuelArt(pack.amount ?? 1, 'sm');
  const buyer = confirmBuy({
    price: pack.price,
    affordable: save.baht >= pack.price,
    label: '구매',
    confirmLabel: '결제',
    size: compact ? 'sm' : 'md',
    onConfirm: (btn) => hooks.buy(pack, btn, api),
    onDeny: (btn) => hooks.deny(pack, btn),
  });
  const el = h(
    'article.fuel-pack',
    { class: [compact && 'fuel-pack--compact', best && 'is-best'], data: { item: pack.id } },
    best ? h('span.fuel-pack__ribbon', 'BEST') : null,
    art,
    h(
      'div.fuel-pack__text',
      h('h3.fuel-pack__name', pack.name),
      h(
        'p.fuel-pack__meta',
        h('span.t-num', `회당 ${fmtBaht(perTrip(pack))}`),
        saving > 0 ? chip({ text: best ? `최고 가성비 −${saving}%` : `−${saving}%`, tone: best ? 'pink' : 'good', size: 'sm', solid: best }) : null,
      ),
    ),
    buyer.el,
  );
  const api: ShopCard = {
    el,
    item: pack,
    target: art,
    refresh: (next) => buyer.setAffordable(next.baht >= pack.price),
    focus: buyer.focus,
  };
  return api;
}

export interface FuelSection {
  el: HTMLElement;
  rows: ShopCard[];
  refresh(save: SaveData): void;
}

export function fuelSection(packs: readonly CatalogItem[], save: SaveData, hooks: ShopCardHooks): FuelSection {
  const rows = packs.map((p) => fuelPackRow(p, save, packs, hooks));
  const tank = h('b.t-num', String(save.fuel));
  const el = h(
    'section.shop-fuel',
    { aria: { label: '연료 충전' } },
    sectionHead('Fuel · น้ำมันขวด', '연료 충전소'),
    h('div.shop-fuel__tank', h('span', '내 연료'), tank, h('span', '회분'), h('span.shop-fuel__rule', '트립 1회 = 1병')),
    h('div.shop-fuel__list', rows.map((r) => r.el)),
  );
  return {
    el,
    rows,
    refresh(next) {
      tank.textContent = String(next.fuel);
      rows.forEach((r) => r.refresh(next));
    },
  };
}
