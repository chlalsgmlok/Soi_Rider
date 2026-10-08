/**
 * Value bars.
 *   statBar({ label: '최고속', value: 0.62, display: '82' })  → garage stats; .set(v, display, previewDelta)
 *   meter({ value: 0.8, tone: 'good' })                       → comfort / fuel; .set(v, tone)
 *   comfortTone(82) → 'good' | 'warn' | 'bad'  (≥ 60 / 30–60 / < 30)
 * Styling: styles/components/controls.css (.stat-bar, .meter).
 */
import { h } from '../core/h';

const TONE_VAR = { good: 'var(--c-leaf)', warn: 'var(--c-amber)', bad: 'var(--c-coral)', info: 'var(--c-cyan)', sun: 'var(--c-mango)' } as const;
export type MeterTone = keyof typeof TONE_VAR;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface StatBar {
  el: HTMLElement;
  /** value 0..1, display text, optional preview delta (−1..1) drawn striped green/red */
  set(value: number, display?: string, delta?: number): void;
}

export function statBar(o: { label: string; value: number; display?: string; delta?: number; paper?: boolean; segments?: number }): StatBar {
  const valueEl = h('span.stat-bar__value');
  const el = h(
    'div.stat-bar',
    { class: o.paper && 'stat-bar--paper', style: { '--seg': o.segments ?? 10 }, role: 'meter', aria: { label: o.label, valuemin: 0, valuemax: 100 } },
    h('span.stat-bar__label', o.label),
    h('span.stat-bar__track', h('span.stat-bar__fill'), h('span.stat-bar__delta')),
    valueEl,
  );
  const set = (value: number, display?: string, delta = 0): void => {
    const v = clamp01(value);
    const d = Math.max(-v, Math.min(1 - v, delta));
    el.style.setProperty('--v', v.toFixed(4));
    el.style.setProperty('--d', d.toFixed(4));
    el.classList.toggle('is-up', d > 0.001);
    el.classList.toggle('is-down', d < -0.001);
    valueEl.textContent = display ?? String(Math.round(v * 100));
    el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  };
  set(o.value, o.display, o.delta);
  return { el, set };
}

export interface Meter {
  el: HTMLElement;
  set(value: number, tone?: MeterTone): void;
}

export function meter(o: { value: number; tone?: MeterTone; size?: 'md' | 'lg'; paper?: boolean; label?: string }): Meter {
  const el = h(
    'div.meter',
    { class: [o.size === 'lg' && 'meter--lg', o.paper && 'meter--paper'], role: 'meter', aria: { label: o.label, valuemin: 0, valuemax: 100 } },
    h('span.meter__fill'),
  );
  let lastV = -1;
  let lastTone: MeterTone | null = null;
  const set = (value: number, tone?: MeterTone): void => {
    const v = clamp01(value);
    if (Math.abs(v - lastV) > 0.002) {
      lastV = v;
      el.style.setProperty('--v', v.toFixed(3));
      el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    }
    const t = tone ?? lastTone ?? 'good';
    if (t !== lastTone) {
      lastTone = t;
      el.style.setProperty('--tone', TONE_VAR[t]);
    }
  };
  set(o.value, o.tone);
  return { el, set };
}

export function comfortTone(value0to100: number): MeterTone {
  return value0to100 >= 60 ? 'good' : value0to100 >= 30 ? 'warn' : 'bad';
}
