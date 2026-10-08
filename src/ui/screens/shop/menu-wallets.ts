/**
 * ฿ + ⛽ wallet pair shown on every menu screen (title, garage, shop, setup).
 *   const w = menuWallets(save);  w.set(nextSave);   (animated count when values change)
 */
import './menu-shared.css';
import type { SaveData } from '../../../core/types/save';
import { h } from '../../core/h';
import { wallet, type Wallet } from '../../components/wallet';

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
  fuel.el.title = '연료 — 트립 1회에 1 사용';
  const el = h('div.menu-wallets', { role: 'group', aria: { label: '지갑과 연료' } }, baht.el, fuel.el);
  return {
    el,
    baht,
    fuel,
    set(next, animate = true) {
      if (next.baht !== baht.value()) void baht.set(next.baht, { animate });
      if (next.fuel !== fuel.value()) void fuel.set(next.fuel, { animate });
    },
  };
}
