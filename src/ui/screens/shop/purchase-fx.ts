/**
 * Purchase feedback shared by garage, shop and setup:
 *   success → 'buy' sfx, coins arc from the ฿ wallet into the item while the wallet counts down; fuel packs then send
 *             bottle tokens back into the ⛽ wallet.
 *   failure → 'deny' sfx + shake (button and ฿ wallet) + a toast saying how much is missing.
 */
import './menu-shared.css';
import type { CatalogItem } from '../../../core/types/save';
import type { BuyResult } from '../../../core/types/screens';
import type { UiServices } from '../../core/screen-types';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { flyCoins } from '../../components/coin';
import { denyButton } from '../../components/button';
import { bump, flyArc, settled, shake, stamp } from '../../core/animate';
import { fmtBaht } from '../../core/count-up';
import { reducedMotion } from '../../core/motion';
import type { MenuWallets } from './menu-wallets';

export interface PurchaseFx {
  ui: UiServices;
  wallets: MenuWallets;
}

type Point = { x: number; y: number };

const centre = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** bottle tokens arc from an element (or a point captured before it was detached) into the ⛽ wallet */
export async function flyFuel(from: Element | Point, to: Element, count: number): Promise<void> {
  if (reducedMotion()) return;
  const a = from instanceof Element ? centre(from) : from;
  const b = centre(to);
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const el = h('span.menu-fly-fuel', icon('fuel', 16));
    document.body.append(el);
    const start = { x: a.x + (i - count / 2) * 10, y: a.y };
    jobs.push(settled(flyArc(el, start, b, { duration: 560 + i * 30, delay: i * 70, lift: 70 })).then(() => el.remove()));
  }
  await Promise.all(jobs);
}

/**
 * Play the purchase beat; resolves once the coins (and fuel tokens) have landed. `target` must stay attached until the
 * coins land; `onDelivered` then runs (its position is captured first), so the caller may swap the target out there.
 */
export async function playPurchase(fx: PurchaseFx, item: CatalogItem, res: BuyResult, target: HTMLElement, pressed: HTMLElement, onDelivered?: () => void): Promise<void> {
  if (!res.ok) {
    denyPurchase(fx, item, pressed, res.reason, res.save.baht);
    return;
  }
  fx.ui.sfx('buy');
  const coins = Math.max(3, Math.min(9, Math.round(item.price / 60)));
  const counting = fx.wallets.baht.set(res.save.baht, { animate: true, duration: 520 });
  await flyCoins(fx.wallets.baht.target, target, coins, { step: 40, onLand: (i) => i === 0 && fx.ui.sfx('coin') });
  bump(target, 0.06);
  const landedAt = centre(target);
  onDelivered?.();
  if (item.category === 'fuel') {
    await flyFuel(landedAt, fx.wallets.fuel.target, Math.min(6, item.amount ?? 1));
    fx.ui.sfx('coin');
    await fx.wallets.fuel.set(res.save.fuel, { animate: true, duration: 420 });
  }
  await counting;
}

export function denyPurchase(fx: PurchaseFx, item: CatalogItem, pressed: HTMLElement, reason: BuyResult['reason'], have: number): void {
  fx.ui.sfx('deny');
  denyButton(pressed);
  if (reason === 'funds' || reason === undefined) {
    shake(fx.wallets.baht.el, 6);
    fx.ui.toast(`${fmtBaht(Math.max(1, item.price - have))} 부족해요 — 콜을 더 뛰어 볼까요?`, 'bad', 'coin');
  } else if (reason === 'owned') fx.ui.toast('이미 갖고 있는 아이템이에요', 'info', 'check');
  else fx.ui.toast('지금은 살 수 없는 아이템이에요', 'warn', 'lock');
}

/** "SOLD" rubber stamp slapped on a card after a purchase */
export function soldStamp(card: HTMLElement, text = '구매 완료'): void {
  const mark = h('span.menu-sold', { aria: { hidden: true } }, text);
  card.append(mark);
  void settled(stamp(mark, { rotate: 0 })).then(() => window.setTimeout(() => mark.remove(), 900));
}
