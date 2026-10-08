/** Style-guide section 10: every motion helper on a live target + the spring curve they share. */
import type { UiServices } from '../core/screen-types';
import type { Child } from '../core/h';
import { h, s } from '../core/h';
import { bump, pop, shake, springSamples, stamp, stagger } from '../core/animate';
import { countUp, fmtInt } from '../core/count-up';
import { button } from './button';
import { card } from './card';
import { chip } from './chip';
import { wallet } from './wallet';
import { flyCoins } from './coin';

type Sec = (kicker: string, title: string, opts: { wide?: boolean; light?: boolean }, ...body: Child[]) => HTMLElement;

/** polyline of the default spring (0 → 1 with overshoot) used by pop/slideIn/stamp */
function springPlot(): SVGSVGElement {
  const pts = springSamples();
  const w = 220;
  const ht = 70;
  const step = w / (pts.length - 1);
  const y = (v: number): number => ht - 8 - v * (ht - 26);
  const line = pts.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return s(
    'svg',
    { viewBox: `0 0 ${w} ${ht}`, width: w, height: ht, class: 'gallery__plot', 'aria-label': 'spring curve' },
    s('line', { x1: 0, x2: w, y1: y(1), y2: y(1), class: 'gallery__plot-target' }),
    s('polyline', { points: line, class: 'gallery__plot-line' }),
  );
}

export function galleryMotion(sec: Sec, ui: UiServices): HTMLElement {
  const target = card({ class: 'gallery__motion-target' }, h('b', '고양이 귀 헬멧'), h('div.t-caption', '450฿ · 첫인상 +1'));
  const num = h('span.t-num.gallery__count', '0');
  const purse = wallet('baht', 1240);
  const chips = h('div.u-row', ['급해요', '첫 방콕', '단골'].map((t) => chip({ text: t, tone: 'info', size: 'sm' })));
  const demo = (label: string, fn: () => void): HTMLButtonElement => button({ label, size: 'sm', variant: 'ghost', onClick: fn });
  return sec(
    '10 · motion',
    '모션 헬퍼 (core/animate)',
    {},
    h('div.gallery__row', target, h('div.u-col', num, purse.el)),
    h(
      'div.gallery__row',
      demo('pop()', () => pop(target)),
      demo('stamp()', () => stamp(target, { rotate: -6 })),
      demo('shake()', () => shake(target)),
      demo('bump()', () => bump(num, 0.25)),
      demo('countUp()', () => countUp(num, 0, 7430, { duration: 900, format: fmtInt })),
      demo('stagger()', () => stagger(chips.children)),
      demo('flyCoins()', () => {
        void flyCoins(target, purse.target, 8, { onLand: () => purse.bump() }).then(() => purse.set(purse.value() + 120, { animate: true }));
      }),
      demo('wipe', () => void ui.transition('wipe')),
      demo('fade', () => void ui.transition('fade')),
    ),
    h('div.gallery__row', chips),
    h('div.gallery__row', springPlot(), h('div.gallery__cap', 'spring k380 c18 — pop · slideIn · stamp · bump bake it into WAAPI keyframes')),
  );
}
