/**
 * Settings row builders on top of the design-system controls: volume slider rows (with % readout), toggle rows and
 * segmented rows whose hint follows the selected option, plus the section block. Each returns { el, set } so the
 * screen can re-sync from props without emitting. Styling: settings.css.
 */
import { h } from '../../core/h';
import { icon, type IconName } from '../../icons/icon';
import { slider, toggle, settingRow } from '../../components/inputs';
import { tabStrip } from '../../components/tab-strip';

export interface Row<T> {
  el: HTMLElement;
  set(v: T): void;
  dispose?(): void;
}

export interface SegOption<T extends string> {
  id: T;
  label: string;
  hint: string;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

export function volumeRow(label: string, hint: string, value: number, onInput: (v: number) => void, onCommit?: (v: number) => void): Row<number> {
  const readout = h('span.setting-row__value');
  const s = slider({ value, label, min: 0, max: 1, step: 0.05, format: pct, readout, onInput, onCommit });
  const control = h('div.set-volume', s.el, readout);
  const el = settingRow(label, hint, control);
  el.classList.toggle('is-muted', value <= 0);
  return {
    el,
    set(v) {
      s.set(v);
      el.classList.toggle('is-muted', v <= 0);
    },
  };
}

export function toggleRow(label: string, hint: string, value: boolean, onChange: (on: boolean) => void): Row<boolean> {
  const t = toggle({ checked: value, label, onChange });
  const el = settingRow(label, hint, t.el);
  el.addEventListener('click', (e) => {
    if (e.target === t.el || t.el.contains(e.target as Node)) return;
    t.set(!t.value(), true);
  });
  el.classList.add('set-row--clickable');
  el.dataset.sfx = 'tap';
  return { el, set: (v) => t.set(v, false) };
}

export function segmentedRow<T extends string>(label: string, value: T, options: SegOption<T>[], onChange: (v: T) => void): Row<T> {
  const el = settingRow(label, null, h('span'));
  const hint = h('span.setting-row__hint');
  el.querySelector('.setting-row__text')?.append(hint);
  const showHint = (v: T): void => {
    hint.textContent = options.find((o) => o.id === v)?.hint ?? '';
  };
  const strip = tabStrip<T>({
    tabs: options.map((o) => ({ id: o.id, label: o.label })),
    active: value,
    segmented: true,
    block: true,
    label,
    onChange: (v) => {
      showHint(v);
      onChange(v);
    },
  });
  el.querySelector('.setting-row__control')?.replaceChildren(strip.el);
  el.classList.add('set-row--stack');
  showHint(value);
  return {
    el,
    set(v) {
      strip.set(v, false);
      showHint(v);
    },
    dispose: () => strip.dispose(),
  };
}

export function section(kicker: string, title: string, glyph: IconName, ...rows: HTMLElement[]): HTMLElement {
  return h(
    'section.set-sec',
    h('div.set-sec__head', h('span.set-sec__icon', icon(glyph, 18)), h('span.set-sec__kicker', kicker), h('h2.set-sec__title', title)),
    h('div.set-sec__rows', rows),
  );
}
