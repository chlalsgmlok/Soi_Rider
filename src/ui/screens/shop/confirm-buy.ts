/**
 * Two-step inline purchase button (no modal): [🛒 구매 ฿450] → [✓ 구매 확인 ฿450][×] → onConfirm.
 * Unaffordable presses go straight to onDeny (the caller shakes + plays 'deny'). The armed state times out after 5 s
 * and disarms on Esc via disarm(). Used by garage cards, the garage footer, shop cards and the setup fuel row.
 */
import './menu-shared.css';
import { h } from '../../core/h';
import { button, type ButtonSize } from '../../components/button';
import { pop } from '../../core/animate';

export interface ConfirmBuyOpts {
  price: number;
  affordable: boolean;
  label?: string;
  confirmLabel?: string;
  size?: ButtonSize;
  block?: boolean;
  onConfirm(btn: HTMLButtonElement): void;
  onDeny(btn: HTMLButtonElement): void;
}

export interface ConfirmBuy {
  el: HTMLElement;
  armed(): boolean;
  disarm(focus?: boolean): void;
  /** focus the idle button */
  focus(): void;
  setAffordable(on: boolean): void;
}

const ARM_MS = 5000;

export function confirmBuy(o: ConfirmBuyOpts): ConfirmBuy {
  let affordable = o.affordable;
  let timer = 0;
  const size = o.size ?? 'md';
  const idle = button({ label: o.label ?? '구매', icon: 'cart', price: o.price, locked: true, affordable, size, block: o.block, sfx: 'tap', onClick: () => press() });
  const ok = button({ label: o.confirmLabel ?? '구매 확인', icon: 'check', price: o.price, variant: 'sun', size, block: o.block, sfx: 'none', onClick: () => confirm() });
  const cancel = button({ icon: 'close', variant: 'ghost', size, title: '취소', sfx: 'back', onClick: () => api.disarm(true) });
  const armedRow = h('span.confirm-buy__armed', { hidden: true }, ok, cancel);
  const el = h('span.confirm-buy', { class: o.block && 'confirm-buy--block' }, idle, armedRow);

  const paint = (): void => {
    idle.classList.toggle('is-affordable', affordable);
    idle.classList.toggle('is-short', !affordable);
  };

  function press(): void {
    if (!affordable) {
      o.onDeny(idle);
      return;
    }
    idle.hidden = true;
    armedRow.hidden = false;
    el.classList.add('is-armed');
    pop(ok, { from: 0.9 });
    ok.focus({ preventScroll: true });
    window.clearTimeout(timer);
    timer = window.setTimeout(() => api.disarm(el.contains(document.activeElement)), ARM_MS);
  }

  function confirm(): void {
    api.disarm(false);
    o.onConfirm(idle);
  }

  const api: ConfirmBuy = {
    el,
    armed: () => !armedRow.hidden,
    disarm(focus = false) {
      window.clearTimeout(timer);
      if (armedRow.hidden) return;
      armedRow.hidden = true;
      idle.hidden = false;
      el.classList.remove('is-armed');
      if (focus) idle.focus({ preventScroll: true });
    },
    focus: () => idle.focus({ preventScroll: true }),
    setAffordable(on) {
      affordable = on;
      paint();
    },
  };
  paint();
  return api;
}
