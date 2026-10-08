/**
 * Accepted-call mini route view inside the gram card: a little soi grid, the cyan dashed gram route drawing itself
 * (masked reveal) from the rider puck to the coral pickup pin, and "손님에게 가는 중 · 예상 N분". The route shape is
 * seeded by the offer id so each call looks different but stable.
 */
import type { JobOffer } from '../../../core/types/game';
import { Rng } from '../../../core/rng';
import { h, s } from '../../core/h';
import { icon } from '../../icons/icon';
import { EASE, reducedMotion } from '../../core/motion';
import { distText, etaMinutes } from './intro-copy';

const W = 292;
const H = 112;
const ROWS = [22, 40, 58, 76, 92];

type Pt = { x: number; y: number };

const hash = (id: string): number => {
  let x = 2166136261;
  for (let i = 0; i < id.length; i++) x = Math.imul(x ^ id.charCodeAt(i), 16777619);
  return x >>> 0;
};

/** manhattan route: three right-legs with lane changes, ending near the right edge */
function routePoints(rng: Rng): Pt[] {
  const start: Pt = { x: 24, y: rng.pick([76, 92]) };
  const pts: Pt[] = [start];
  let { x, y } = start;
  for (let leg = 0; leg < 3; leg++) {
    x = Math.min(W - 36, x + rng.int(56, 84));
    pts.push({ x, y });
    if (leg < 2) {
      y = rng.pick(ROWS.filter((v) => Math.abs(v - y) > 14));
      pts.push({ x, y });
    }
  }
  pts.push({ x: W - 36, y });
  return pts;
}

export interface OfferRoute {
  el: HTMLElement;
  /** start the draw-on animation */
  play(): void;
}

export function offerRoute(offer: JobOffer, pickupName: string): OfferRoute {
  const seed = hash(offer.id);
  const pts = routePoints(new Rng(seed).fork('intro-route'));
  const start = pts[0];
  const end = pts[pts.length - 1];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');
  const maskId = `or-mask-${seed.toString(36)}`;
  const reveal = s('path', { d, class: 'or-reveal', pathLength: 100 });

  const blocks: SVGElement[] = [];
  for (let bx = 6; bx < W; bx += 48) for (let by = 4; by < H; by += 36) blocks.push(s('rect', { x: bx, y: by, width: 40, height: 28, rx: 5, class: 'or-block' }));

  const svg = s(
    'svg.offer-route__map',
    { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' },
    s('defs', null, s('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, reveal)),
    ...blocks,
    s('g', { mask: `url(#${maskId})` }, s('path', { d, class: 'or-casing' }), s('path', { d, class: 'or-route' })),
    s('circle', { cx: end.x, cy: end.y, r: 12, class: 'or-pulse' }),
    s(
      'g',
      { transform: `translate(${end.x - 10} ${end.y - 23})`, class: 'or-pin' },
      s('path', { d: 'M10 0C4.5 0 0 4.4 0 9.8 0 16.5 10 24 10 24s10-7.5 10-14.2C20 4.4 15.5 0 10 0z' }),
      s('circle', { cx: 10, cy: 9.6, r: 3.6, class: 'or-pin-hole' }),
    ),
    s('g', { transform: `translate(${start.x} ${start.y}) rotate(90)`, class: 'or-rider' }, s('circle', { r: 9 }), s('path', { d: 'M-3.6 3.6 0-4.8 3.6 3.6 0 1.6z', class: 'or-rider-arrow' })),
  );

  const el = h(
    'div.offer-route',
    svg,
    h('div.offer-route__eta', h('span.offer-route__live'), h('b', '손님에게 가는 중'), h('span', ` · 예상 ${etaMinutes(offer.approachMeters)}분`)),
    h('div.offer-route__pick', icon('pin', 14), h('span.offer-route__pick-name', '픽업 · ', pickupName), h('span.offer-route__dist.t-num', distText(offer.approachMeters))),
  );

  return {
    el,
    play() {
      if (reducedMotion()) return;
      reveal.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: 950, delay: 120, easing: EASE.inout, fill: 'backwards' });
    },
  };
}
