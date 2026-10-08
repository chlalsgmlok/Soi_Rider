/**
 * WAAPI motion helpers with real spring physics baked into keyframes (no rAF loop, compositor-friendly).
 * Every helper respects reduced motion (falls back to a short fade or an instant state) and returns the Animation (or null).
 */
import { DUR, EASE, reducedMotion } from './motion';

export interface SpringOpts {
  /** stiffness k (default 380) */
  k?: number;
  /** damping c (default 18) */
  c?: number;
  /** mass (default 1) */
  m?: number;
}

/** Sample a damped spring from 0 → 1. Returns progress samples (≈60 fps) until settled. */
export function springSamples({ k = 380, c = 18, m = 1 }: SpringOpts = {}): number[] {
  const out: number[] = [];
  let x = 0;
  let v = 0;
  const dt = 1 / 120;
  for (let i = 0; i < 480; i++) {
    const a = (k * (1 - x) - c * v) / m;
    v += a * dt;
    x += v * dt;
    if (i % 2 === 0) out.push(x);
    if (i > 40 && Math.abs(1 - x) < 0.002 && Math.abs(v) < 0.02) break;
  }
  out.push(1);
  return out;
}

/** Build spring keyframes mapping progress p (0→1, may overshoot) to a Keyframe. Duration = samples · 16.7 ms. */
export function springFrames(map: (p: number) => Keyframe, opts?: SpringOpts): { frames: Keyframe[]; duration: number } {
  const samples = springSamples(opts);
  return { frames: [map(0), ...samples.map(map)], duration: Math.round((samples.length * 1000) / 60) };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Springy scale-in pop (DESIGN_SYSTEM §4: .85 → 1). */
export function pop(el: Element, { from = 0.85, delay = 0, spring }: { from?: number; delay?: number; spring?: SpringOpts } = {}): Animation | null {
  if (reducedMotion()) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay, fill: 'backwards' });
  const { frames, duration } = springFrames((p) => ({ transform: `scale(${lerp(from, 1, p).toFixed(4)})`, opacity: Math.min(1, p * 2.2) }), spring);
  return el.animate(frames, { duration, delay, fill: 'backwards', easing: 'linear' });
}

/** Quick shrink + fade out. Resolve `.finished` before removing the element. */
export function popOut(el: Element, { to = 0.9, duration = DUR.chip }: { to?: number; duration?: number } = {}): Animation {
  const d = reducedMotion() ? 80 : duration;
  return el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${to})`, opacity: 0 }], { duration: d, easing: EASE.in, fill: 'forwards' });
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** Slide in from a side with spring settle. */
export function slideIn(el: Element, side: Side = 'bottom', { distance = 28, delay = 0, spring }: { distance?: number; delay?: number; spring?: SpringOpts } = {}): Animation {
  if (reducedMotion()) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay, fill: 'backwards' });
  const [ax, sign] = side === 'left' ? ['X', -1] : side === 'right' ? ['X', 1] : side === 'top' ? ['Y', -1] : ['Y', 1];
  const { frames, duration } = springFrames((p) => ({ transform: `translate${ax}(${(sign * distance * (1 - p)).toFixed(2)}px)`, opacity: Math.min(1, p * 1.8) }), spring ?? { k: 260, c: 22 });
  return el.animate(frames, { duration, delay, fill: 'backwards', easing: 'linear' });
}

export function slideOut(el: Element, side: Side = 'bottom', distance = 24): Animation {
  const t = side === 'left' ? `translateX(${-distance}px)` : side === 'right' ? `translateX(${distance}px)` : side === 'top' ? `translateY(${-distance}px)` : `translateY(${distance}px)`;
  return el.animate([{ transform: 'none', opacity: 1 }, { transform: t, opacity: 0 }], { duration: reducedMotion() ? 80 : DUR.chip, easing: EASE.in, fill: 'forwards' });
}

/** Horizontal error shake (deny / can't afford). */
export function shake(el: Element, strength = 8): Animation | null {
  if (reducedMotion()) return null;
  const k = [0, -1, 0.9, -0.7, 0.5, -0.3, 0.15, 0].map((f) => ({ transform: `translateX(${(f * strength).toFixed(1)}px)` }));
  return el.animate(k, { duration: 420, easing: 'linear' });
}

/** Little vertical squash-bounce for counters / wallet bumps. */
export function bump(el: Element, amount = 0.12): Animation | null {
  if (reducedMotion()) return null;
  const { frames, duration } = springFrames((p) => ({ transform: `scale(${(1 + amount * (1 - p)).toFixed(4)})` }), { k: 520, c: 14 });
  return el.animate(frames, { duration, easing: 'linear' });
}

/** Rubber-stamp slam: big + rotated → lands with overshoot. Use for grade stamps / "PAID" marks. */
export function stamp(el: Element, { delay = 0, rotate = -12 }: { delay?: number; rotate?: number } = {}): Animation {
  if (reducedMotion()) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay, fill: 'backwards' });
  const { frames, duration } = springFrames(
    (p) => ({ transform: `rotate(${lerp(rotate - 18, rotate, p).toFixed(2)}deg) scale(${lerp(2.6, 1, p).toFixed(4)})`, opacity: Math.min(1, p * 4) }),
    { k: 620, c: 24 },
  );
  return el.animate(frames, { duration, delay, fill: 'backwards', easing: 'linear' });
}

/** Stagger children in (rise + fade). Returns the animations. */
export function stagger(children: Iterable<Element>, { step = 45, delay = 60, distance = 12 }: { step?: number; delay?: number; distance?: number } = {}): Animation[] {
  const out: Animation[] = [];
  let i = 0;
  for (const el of children) {
    const d = delay + step * i++;
    out.push(
      reducedMotion()
        ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, delay: d, fill: 'backwards' })
        : el.animate([{ opacity: 0, transform: `translateY(${distance}px) scale(.98)` }, { opacity: 1, transform: 'none' }], { duration: DUR.card, delay: d, easing: EASE.out, fill: 'backwards' }),
    );
  }
  return out;
}

/** Fly an element along a quadratic arc from one screen point to another (coins → wallet). */
export function flyArc(el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }, { duration = 700, delay = 0, lift = 120 }: { duration?: number; delay?: number; lift?: number } = {}): Animation {
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - lift;
  const frames: Keyframe[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * cx + e * e * to.x;
    const y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * cy + e * e * to.y;
    const sc = 1 + Math.sin(Math.PI * t) * 0.35 - t * 0.25;
    frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(3)}) rotate(${(t * 540).toFixed(0)}deg)`, opacity: t > 0.92 ? 0 : 1 });
  }
  return el.animate(frames, { duration: reducedMotion() ? 1 : duration, delay, easing: 'linear', fill: 'both' });
}

/** Await an animation that may be null; never rejects (cancelled animations resolve too). */
export async function settled(anim: Animation | null | undefined): Promise<void> {
  if (!anim) return;
  try {
    await anim.finished;
  } catch {
    /* cancelled — treat as done */
  }
}
