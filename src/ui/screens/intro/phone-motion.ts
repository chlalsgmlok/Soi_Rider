/**
 * Intro phone choreography: spring the handset up from the bottom-right corner, and shrink it into the HUD's gram
 * mini-phone spot (bottom-left) once a call is accepted. Both reduced-motion aware.
 */
import { springFrames } from '../../core/animate';
import { EASE, reducedMotion } from '../../core/motion';

type Rect = { x: number; y: number; w: number; h: number };

/** handset rises from below the right edge, tilted, and settles with a spring overshoot */
export function phoneRise(phone: HTMLElement, delay = 0): Animation {
  if (reducedMotion()) return phone.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay, fill: 'backwards' });
  const { frames, duration } = springFrames(
    (p) => {
      const q = 1 - p;
      return { transform: `translate(${(150 * q).toFixed(1)}px, ${(620 * q).toFixed(1)}px) rotate(${(14 * q).toFixed(2)}deg)`, opacity: Math.min(1, p * 3) };
    },
    { k: 150, c: 17 },
  );
  return phone.animate(frames, { duration, delay, easing: 'linear', fill: 'backwards' });
}

const cssNum = (name: string, fallback: number): number => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/** where the HUD mini-phone sits (its rest position, even while the HUD is still hidden) */
export function hudPhoneRect(): Rect {
  const z = cssNum('--hud-zoom', 1);
  const corner = document.querySelector<HTMLElement>('.hud__bl');
  const mini = corner?.querySelector<HTMLElement>('.hud-phone');
  if (corner && mini) {
    const r = mini.getBoundingClientRect();
    const t = getComputedStyle(corner).transform;
    const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : null;
    if (r.width > 40) return { x: r.left - (m?.m41 ?? 0) * z, y: r.top - (m?.m42 ?? 0) * z, w: r.width, h: r.height };
  }
  const safe = window.innerWidth >= 1280 ? 24 : 16;
  const w = 248 * z;
  const hgt = 262 * z;
  return { x: safe, y: window.innerHeight - safe - hgt, w, h: hgt };
}

/**
 * Shrink the phone into `target` (screen px). The element may live inside a CSS-zoomed stage: translations are
 * divided by that zoom. The visible height is clipped to the mini-phone's proportions while the content fades.
 */
export function phoneShrink(phone: HTMLElement, screen: HTMLElement, target: Rect, zoom: number): Animation {
  if (reducedMotion()) return phone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  const r = phone.getBoundingClientRect();
  const s = target.w / r.width;
  const dx = (target.x - r.left) / zoom;
  const dy = (target.y - r.top) / zoom;
  const keepH = Math.min(100, ((target.h / s) / r.height) * 100);
  const clipBottom = (100 - keepH).toFixed(2);
  screen.animate([{ opacity: 1 }, { opacity: 0.15, offset: 0.55 }, { opacity: 0 }], { duration: 640, easing: EASE.in, fill: 'forwards' });
  return phone.animate(
    [
      { transform: 'none', clipPath: 'inset(0 0 0% 0 round 44px)', opacity: 1, offset: 0 },
      { transform: `translate(${(dx * 0.15).toFixed(1)}px, ${(dy * 0.15 - 18).toFixed(1)}px) scale(1.03)`, clipPath: 'inset(0 0 0% 0 round 44px)', opacity: 1, offset: 0.18 },
      { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})`, clipPath: `inset(0 0 ${clipBottom}% 0 round ${(26 / s).toFixed(1)}px)`, opacity: 0.9, offset: 0.92 },
      { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})`, clipPath: `inset(0 0 ${clipBottom}% 0 round ${(26 / s).toFixed(1)}px)`, opacity: 0, offset: 1 },
    ],
    { duration: 720, easing: EASE.inout, fill: 'forwards' },
  );
}
