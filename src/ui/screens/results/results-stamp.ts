/**
 * Grade stamp beat: the rubber stamp slams onto the receipt (components/receipt gradeStamp + animate.stamp) with an
 * ink splash in the grade colour, a paper jolt and — for S/A — a short confetti burst. Reduced-motion aware.
 */
import type { Grade } from '../../../core/types/game';
import { h, s } from '../../core/h';
import { gradeStamp } from '../../components/receipt';
import { stamp } from '../../core/animate';
import { EASE, reducedMotion } from '../../core/motion';

/** irregular ink drops around the stamp (100×100 box, centre 50,50) */
const DROPS: ReadonlyArray<[number, number, number]> = [
  [6, 34, 5.2], [12, 62, 3.2], [92, 20, 4.2], [96, 56, 5.4], [28, 4, 3], [4, 48, 2.2], [86, 76, 2.4], [58, 0, 2], [74, 6, 1.6],
];

function splashSvg(): SVGSVGElement {
  return s(
    'svg.res-splash',
    { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    ...DROPS.map(([cx, cy, r]) => s('circle', { cx, cy, r })),
    s('path', { d: 'M50 50 L2 41 L3 45z M50 50 L97 38 L96 42z M50 50 L66 1 L62 0z', class: 'res-splash__streak' }),
  );
}

export interface GradeMark {
  el: HTMLElement;
  /** returns the stamp animation; also fires splash, jolt and (unless quiet, e.g. fast-forwarded) confetti */
  slam(jolt: HTMLElement, quiet?: boolean): Animation;
}

export function gradeMark(grade: Grade): GradeMark {
  const st = gradeStamp(grade, { label: grade === 'F' ? 'SOI RIDER · FAILED' : 'SOI RIDER · GRADE' });
  const splash = splashSvg();
  const el = h('div.res-stamp', { data: { grade } }, splash, st);
  return {
    el,
    slam(jolt, quiet = false) {
      el.classList.add('is-in');
      const anim = stamp(st, { rotate: -12 });
      if (reducedMotion() || quiet) return anim;
      const hit = { delay: 150, easing: EASE.out, fill: 'backwards' as const };
      splash.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 0.9, offset: 0.35 }, { transform: 'scale(1)', opacity: 0.75 }], { ...hit, duration: 420 });
      jolt.animate([{ transform: 'none' }, { transform: 'translateY(5px) rotate(-.6deg)' }, { transform: 'translateY(-2px) rotate(.25deg)' }, { transform: 'none' }], { duration: 300, delay: 150, easing: EASE.out });
      if (grade === 'S' || grade === 'A') confetti(el, grade === 'S' ? 26 : 16);
      return anim;
    },
  };
}

const CONFETTI = ['var(--c-cyan)', 'var(--c-pink)', 'var(--c-mango)', 'var(--c-leaf-hi)', 'var(--c-coral)'];

/** paper bits bursting from the stamp (fixed-position clones, removed when done) */
function confetti(from: HTMLElement, n: number): void {
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 120;
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist * 0.7 - 40;
    const bit = h('i.res-confetti', { style: { left: `${cx}px`, top: `${cy}px`, background: CONFETTI[i % CONFETTI.length] } });
    document.body.append(bit);
    const spin = Math.round(Math.random() * 720 - 360);
    const anim = bit.animate(
      [
        { transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${dy.toFixed(0)}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(calc(-50% + ${(dx * 1.15).toFixed(0)}px), calc(-50% + ${(dy + 120).toFixed(0)}px)) rotate(${spin * 0.85}deg)`, opacity: 1, offset: 0.85 },
        { transform: `translate(calc(-50% + ${(dx * 1.2).toFixed(0)}px), calc(-50% + ${(dy + 160).toFixed(0)}px)) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: 1100 + Math.random() * 400, delay: 160, easing: EASE.out, fill: 'backwards' },
    );
    anim.onfinish = () => bit.remove();
    anim.oncancel = () => bit.remove();
  }
}
