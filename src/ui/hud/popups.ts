/**
 * Combo popups ("NEAR MISS ×3 +120", "PERFECT GAP +150", "FILTER +15") rising from the rider anchor.
 * Pooled DOM (no allocation per popup), WAAPI rise/pop/fade, bursts stack upwards so they never overlap.
 */
import type { ScreenPoint } from '../../core/types/geometry';
import type { PopupKind } from './types';
import { h } from '../core/h';
import { reducedMotion } from '../core/motion';
import { splitPopup } from './format';

const POOL = 8;
const LIFE_MS = 1150;
const STACK_PX = 46;

interface Slot {
  el: HTMLElement;
  label: HTMLElement;
  pts: HTMLElement;
  busyUntil: number;
  anim: Animation | null;
}

export class ComboPopups {
  readonly el: HTMLElement;
  private slots: Slot[] = [];
  private recent: number[] = [];

  constructor() {
    this.el = h('div.hud-pops', { style: { display: 'contents' } });
    for (let i = 0; i < POOL; i++) {
      const label = h('span.hud-pop__label');
      const pts = h('span.hud-pop__pts');
      const el = h('div.hud-pop', { aria: { hidden: true }, style: { opacity: '0' } }, h('div.hud-pop__inner', label, pts));
      this.el.append(el);
      this.slots.push({ el, label, pts, busyUntil: 0, anim: null });
    }
  }

  spawn(kind: PopupKind, text: string, at: ScreenPoint): void {
    const now = performance.now();
    this.recent = this.recent.filter((t) => now - t < 420);
    const stack = this.recent.length;
    this.recent.push(now);
    const slot = this.slots.find((s) => s.busyUntil < now) ?? this.slots.reduce((a, b) => (a.busyUntil < b.busyUntil ? a : b));
    slot.anim?.cancel();
    slot.busyUntil = now + LIFE_MS;
    const { label, pts } = splitPopup(text);
    slot.label.textContent = label;
    slot.pts.textContent = pts;
    slot.pts.hidden = !pts;
    slot.el.className = `hud-pop hud-pop--${kind}`;
    const x = at.x + (stack ? (stack % 2 ? 22 : -22) : 0);
    const y = at.y - 34 - stack * STACK_PX;
    const tf = (dy: number, sc: number, rot = 0): string => `translate3d(${x.toFixed(1)}px, ${(y + dy).toFixed(1)}px, 0) rotate(${rot}deg) scale(${sc})`;
    const tilt = kind === 'perfect' ? -4 : 0;
    const frames: Keyframe[] = reducedMotion()
      ? [
          { transform: tf(0, 1), opacity: 0 },
          { transform: tf(0, 1), opacity: 1, offset: 0.1 },
          { transform: tf(0, 1), opacity: 1, offset: 0.8 },
          { transform: tf(0, 1), opacity: 0 },
        ]
      : [
          { transform: tf(16, 0.4, tilt), opacity: 0 },
          { transform: tf(-6, 1.22, tilt), opacity: 1, offset: 0.12 },
          { transform: tf(-14, 0.96, tilt), opacity: 1, offset: 0.22 },
          { transform: tf(-20, 1, tilt), opacity: 1, offset: 0.3 },
          { transform: tf(-62, 1, tilt), opacity: 1, offset: 0.78 },
          { transform: tf(-92, 0.9, tilt), opacity: 0 },
        ];
    slot.anim = slot.el.animate(frames, { duration: LIFE_MS, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  }

  clear(): void {
    for (const s of this.slots) {
      s.anim?.cancel();
      s.busyUntil = 0;
    }
  }
}
