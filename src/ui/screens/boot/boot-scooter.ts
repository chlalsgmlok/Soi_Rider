/**
 * Side-view cartoon scooter + win rider (orange vest, white helmet) for the boot loading road.
 * Pure SVG art; the wheels "spin" by marching a dashed tread ring (stroke-dashoffset — no SVG transforms, which
 * mis-resolve their origin inside CSS-zoomed stages) and the body bobs via CSS; both stop under reduced motion.
 */
import { s } from '../../core/h';

function wheel(cx: number): SVGGElement {
  return s(
    'g.boot-scooter__wheel',
    null,
    s('circle', { cx, cy: 39, r: 7, class: 'bs-tyre' }),
    s('circle', { cx, cy: 39, r: 4.6, class: 'bs-tread', pathLength: 24 }),
    s('circle', { cx, cy: 39, r: 2.2, class: 'bs-hub' }),
  );
}

/** 64×52 scooter facing right (+x); rider sits at x≈26 */
export function scooterSvg(): SVGSVGElement {
  return s(
    'svg.boot-scooter',
    { viewBox: '0 -6 64 52', 'aria-hidden': 'true' },
    s('ellipse', { cx: 33, cy: 46.5, rx: 25, ry: 2.6, class: 'bs-shadow' }),
    s(
      'g.boot-scooter__body',
      null,
      // rear shell, floorboard and front apron (mint, like the mockup's scooter)
      s('path', {
        class: 'bs-paint',
        d: 'M5 34c0-7 5-11 12-11h17c2 0 3 1 3 3v6h6l3-14h4l-1 6c5 2 8 6 9 10l1 3H45c-1 3-4 5-7 5H24c-2-4-5-6-9-6-4 0-7 2-8 5H5z',
      }),
      s('path', { class: 'bs-paint-dark', d: 'M37 32h6l-1 5h-5zM50 30c2 1 3 3 4 5h-5z' }),
      // seat, tail light, headlight, handlebar
      s('rect', { x: 13, y: 19.5, width: 21, height: 4.5, rx: 2.2, class: 'bs-seat' }),
      s('rect', { x: 3.5, y: 26, width: 3, height: 3.4, rx: 1, class: 'bs-tail' }),
      s('circle', { cx: 53.5, cy: 24.5, r: 2.1, class: 'bs-lamp' }),
      s('path', { d: 'M47 17l-4-5M41 11.5h4', class: 'bs-bar' }),
      // rider: legs, vest, arm, helmet
      s('path', { d: 'M21 21l11 1 4 9', class: 'bs-leg' }),
      s('path', { d: 'M18 22c-1-8 2-14 8-16l5 1c2 6 1 11-2 15z', class: 'bs-vest' }),
      s('path', { d: 'M24 12.5c1.6 1 3.4 1.4 5.4 1.1', class: 'bs-vest-stripe' }),
      s('path', { d: 'M28 9l8 4 6-1', class: 'bs-arm' }),
      s('circle', { cx: 28.5, cy: 0.6, r: 6.4, class: 'bs-helmet' }),
      s('path', { d: 'M30 -1.6h4.8c.4 1.4.2 2.8-.6 3.8H30z', class: 'bs-visor' }),
    ),
    wheel(15),
    wheel(50),
  );
}
