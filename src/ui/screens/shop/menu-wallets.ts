/**
 * ฿ + ⛽ wallet pair shown on every menu screen (title, garage, shop, setup).
 *   const w = menuWallets(save);  w.set(nextSave);   (animated count when values change)
 */
import './menu-shared.css';
import type { SaveData } from '../../../core/types/save';
import { h } from '../../core/h';
import { wallet, type Wallet } from '../../components/wallet';
import { FUEL_REGEN_CAP, FUEL_REGEN_MINUTES } from '../../../core/config/catalog';
import { watchRegen } from './regen-timer';

export interface MenuWallets {
  el: HTMLElement;
  baht: Wallet;
  fuel: Wallet;
  set(save: SaveData, animate?: boolean): void;
}

export function menuWallets(save: SaveData): MenuWallets {
  const baht = wallet('baht', save.baht);
  const fuel = wallet('fuel', save.fuel);
  baht.el.title = '보유 바트';
  fuel.el.title = `연료 — 트립 1회에 1 사용 · ${FUEL_REGEN_MINUTES}분마다 1 자동 충전 (최대 ${FUEL_REGEN_CAP})`;
  let current = save;
  const regen = h('span.wallet__timer.t-num', { aria: { hidden: true } });
  fuel.el.append(regen);
  watchRegen(regen, () => current);
  const el = h('div.menu-wallets', { role: 'group', aria: { label: '지갑과 연료' } }, baht.el, fuel.el);
  return {
    el,
    baht,
    fuel,
    set(next, animate = true) {
      current = next;
      if (next.baht !== baht.value()) void baht.set(next.baht, { animate });
      if (next.fuel !== fuel.value()) void fuel.set(next.fuel, { animate });
    },
  };
}
