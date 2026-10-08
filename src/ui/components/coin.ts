/**
 * Coin token + the "coins fly to the wallet" reward beat (DESIGN_SYSTEM §4).
 *   await flyCoins(receiptTotalEl, wallet.target, 10, { onLand: () => sfx('coin') });
 */
import { h } from '../core/h';
import { flyArc, settled } from '../core/animate';
import { reducedMotion } from '../core/motion';

export function coin(size?: number): HTMLSpanElement {
  return h('span.coin', { style: size ? { fontSize: `${size}px` } : undefined });
}

type Point = { x: number; y: number };

const centre = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export interface FlyOpts {
  /** stagger between coins (ms) */
  step?: number;
  /** called as each coin lands (play 'coin' sfx, bump the wallet) */
  onLand?: (index: number) => void;
  /** parent for the flying clones (default document.body) */
  layer?: HTMLElement;
}

export async function flyCoins(from: Element | Point, to: Element, count = 8, opts: FlyOpts = {}): Promise<void> {
  const layer = opts.layer ?? document.body;
  const a = from instanceof Element ? centre(from) : from;
  const b = centre(to);
  if (reducedMotion()) {
    opts.onLand?.(count - 1);
    return;
  }
  const step = opts.step ?? 55;
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const el = h('span.coin.coin--fly');
    layer.append(el);
    const spread = { x: a.x + (Math.random() - 0.5) * 60, y: a.y + (Math.random() - 0.5) * 24 };
    const anim = flyArc(el, spread, b, { duration: 620 + Math.random() * 160, delay: i * step, lift: 90 + Math.random() * 80 });
    jobs.push(
      settled(anim).then(() => {
        el.remove();
        opts.onLand?.(i);
      }),
    );
  }
  await Promise.all(jobs);
}
