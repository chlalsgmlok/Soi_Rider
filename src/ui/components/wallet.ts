/**
 * Currency / fuel counters for Title, Garage, Shop, Setup, Results.
 *   const w = wallet('baht', save.baht);  w.set(next, { animate: true });  flyCoins(fromEl, w.el, 8)
 * Styling: .wallet in styles/components/chips.css.
 */
import { h } from '../core/h';
import { icon } from '../icons/icon';
import { countUp, fmtInt, type CountUp } from '../core/count-up';
import { bump } from '../core/animate';

export type WalletKind = 'baht' | 'fuel';

export interface Wallet {
  el: HTMLElement;
  /** coin / fuel icon element: target for flyCoins */
  target: HTMLElement;
  value(): number;
  set(v: number, opts?: { animate?: boolean; duration?: number; onStep?: (v: number) => void }): Promise<void>;
  bump(): void;
}

export function wallet(kind: WalletKind, initial: number): Wallet {
  const valueEl = h('span.wallet__value.t-num', fmtInt(initial));
  const target = kind === 'baht' ? h('span.coin') : h('span.wallet__icon', icon('fuel', 18));
  const el = h(
    'div.wallet',
    { class: [`wallet--${kind}`, initial <= 0 && 'is-empty'], aria: { label: kind === 'baht' ? `보유 ${initial}바트` : `연료 ${initial}` } },
    target,
    valueEl,
    kind === 'fuel' ? h('span.wallet__unit', '회') : null,
  );
  let current = initial;
  let running: CountUp | null = null;
  return {
    el,
    target,
    value: () => current,
    set(v, opts = {}) {
      running?.cancel();
      const from = current;
      current = v;
      el.classList.toggle('is-empty', v <= 0);
      el.setAttribute('aria-label', kind === 'baht' ? `보유 ${v}바트` : `연료 ${v}`);
      if (!opts.animate) {
        valueEl.textContent = fmtInt(v);
        return Promise.resolve();
      }
      running = countUp(valueEl, from, v, { duration: opts.duration ?? 700, onStep: opts.onStep });
      bump(el, 0.08);
      return running.done;
    },
    bump: () => {
      bump(el, 0.12);
    },
  };
}
