/**
 * Passenger portrait drawn from PassengerLook colours (skin, shirt, hair style + colour) — matches the 3D rig.
 *   avatar(passenger.look, 'md')  → <div.avatar><svg/></div>
 * Styling: .avatar in styles/components/phone.css.
 */
import type { PassengerLook } from '../../core/types/game';
import { h, s } from '../core/h';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const f = (c: number): number => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function hair(look: PassengerLook): SVGElement[] {
  const c = look.hairColor;
  const hi = shade(c, 0.25);
  switch (look.hair) {
    case 'hair_long':
      return [
        s('path', { d: 'M16 30c-1-11 6-18 16-18s17 7 16 18l1 20c-3 3-7 4-9 3l-1-17c-5-1-11-4-14-8-2 4-4 6-6 8l-1 17c-2 1-6 0-9-3z', fill: c }),
        s('path', { d: 'M22 21c4-4 9-5 14-4', stroke: hi, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }),
      ];
    case 'hair_bun':
      return [
        s('circle', { cx: 32, cy: 10, r: 6, fill: c }),
        s('path', { d: 'M17 30c-1-10 6-16 15-16s16 6 15 16c-4-5-9-7-15-8-6 1-11 3-15 8z', fill: c }),
      ];
    case 'hat_cap':
      return [
        s('path', { d: 'M16 27c0-9 7-15 16-15s16 6 16 15z', fill: c }),
        s('path', { d: 'M38 26h15c1 0 1 2 0 3H38z', fill: shade(c, -0.25) }),
        s('circle', { cx: 32, cy: 12.5, r: 1.6, fill: shade(c, -0.3) }),
      ];
    default:
      return [s('path', { d: 'M17 29c-1-10 6-16 15-16s16 6 15 16c-3-4-6-6-9-6l-2-3-2 3c-6 0-12 2-17 6z', fill: c })];
  }
}

/** standalone SVG (64×64 viewBox) — reuse in story cards and receipts */
export function avatarSvg(look: PassengerLook): SVGSVGElement {
  const skin = look.skin;
  return s(
    'svg',
    { viewBox: '0 0 64 64', 'aria-hidden': 'true' },
    // shoulders / shirt
    s('path', { d: 'M8 66c1-12 10-19 24-19s23 7 24 19z', fill: look.shirt }),
    s('path', { d: 'M25 48c2 4 4 6 7 6s5-2 7-6', fill: 'none', stroke: shade(look.shirt, -0.3), 'stroke-width': 2, 'stroke-linecap': 'round' }),
    // neck + head
    s('rect', { x: 27, y: 38, width: 10, height: 10, rx: 4, fill: shade(skin, -0.12) }),
    s('ellipse', { cx: 32, cy: 30, rx: 13.5, ry: 14.5, fill: skin }),
    s('ellipse', { cx: 18.6, cy: 31, rx: 2.6, ry: 3.4, fill: shade(skin, -0.08) }),
    s('ellipse', { cx: 45.4, cy: 31, rx: 2.6, ry: 3.4, fill: shade(skin, -0.08) }),
    // face
    s('circle', { cx: 27, cy: 31, r: 1.7, fill: '#1e1b1a' }),
    s('circle', { cx: 37, cy: 31, r: 1.7, fill: '#1e1b1a' }),
    s('ellipse', { cx: 23.5, cy: 36, rx: 2.6, ry: 1.5, fill: '#ff8a8a', opacity: 0.35 }),
    s('ellipse', { cx: 40.5, cy: 36, rx: 2.6, ry: 1.5, fill: '#ff8a8a', opacity: 0.35 }),
    s('path', { d: 'M28.5 37.5c2 1.8 5 1.8 7 0', fill: 'none', stroke: '#7a3b2e', 'stroke-width': 1.6, 'stroke-linecap': 'round' }),
    ...hair(look),
  );
}

export function avatar(look: PassengerLook, size: 'sm' | 'md' | 'lg' = 'md'): HTMLDivElement {
  return h('div.avatar', { class: size !== 'md' && `avatar--${size}` }, avatarSvg(look));
}

/** replace the portrait in an existing .avatar element */
export function setAvatar(el: HTMLElement, look: PassengerLook): void {
  el.replaceChildren(avatarSvg(look));
}
