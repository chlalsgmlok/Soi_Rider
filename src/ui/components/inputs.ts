/**
 * Form controls for Settings / Setup. They keep ARIA state and the CSS fill variable in sync so screens never touch them.
 *   const t = toggle({ checked: settings.minimap, label: '미니맵', onChange: (on) => save({ minimap: on }) });
 *   const v = slider({ value: settings.music, label: '음악', format: (x) => `${Math.round(x * 100)}%`, onInput: (x) => setMusic(x) });
 * FocusNav leaves ←/→ to a focused slider (it changes the value) and moves focus with ↑/↓.
 * Styling: .toggle / .slider / .setting-row in styles/components/controls.css.
 */
import { h, type ClassValue } from '../core/h';

export interface Toggle {
  el: HTMLButtonElement;
  value(): boolean;
  set(on: boolean, emit?: boolean): void;
}

export function toggle(o: { checked: boolean; label: string; onChange?: (on: boolean) => void; disabled?: boolean; class?: ClassValue }): Toggle {
  let on = o.checked;
  const el = h('button.toggle', {
    type: 'button',
    role: 'switch',
    class: o.class,
    disabled: o.disabled ?? false,
    aria: { checked: on, label: o.label },
    data: { sfx: 'tap' },
    on: { click: () => api.set(!on, true) },
  });
  const api: Toggle = {
    el,
    value: () => on,
    set(next, emit = false) {
      const changed = next !== on;
      on = next;
      el.setAttribute('aria-checked', String(on));
      if (emit && changed) o.onChange?.(on);
    },
  };
  return api;
}

export interface Slider {
  el: HTMLInputElement;
  value(): number;
  set(v: number): void;
}

export interface SliderOpts {
  value: number;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  /** optional live readout element text (e.g. "70%"); pass `readout` to show it */
  format?: (v: number) => string;
  readout?: HTMLElement;
  onInput?: (v: number) => void;
  /** fires once on release (persist settings here) */
  onCommit?: (v: number) => void;
}

export function slider(o: SliderOpts): Slider {
  const min = o.min ?? 0;
  const max = o.max ?? 1;
  const el = h('input.slider', { type: 'range', min, max, step: o.step ?? 0.01, value: String(o.value), aria: { label: o.label } });
  const paint = (v: number): void => {
    el.style.setProperty('--v', ((v - min) / (max - min || 1)).toFixed(4));
    el.setAttribute('aria-valuetext', o.format ? o.format(v) : String(v));
    if (o.readout) o.readout.textContent = o.format ? o.format(v) : String(v);
  };
  el.addEventListener('input', () => {
    const v = Number(el.value);
    paint(v);
    o.onInput?.(v);
  });
  el.addEventListener('change', () => o.onCommit?.(Number(el.value)));
  paint(o.value);
  return {
    el,
    value: () => Number(el.value),
    set(v) {
      el.value = String(v);
      paint(v);
    },
  };
}

/** label · control row used by settings lists: settingRow('미니맵', '주행 중 지도 표시', toggle(...).el) */
export function settingRow(label: string, hint: string | null, control: HTMLElement): HTMLDivElement {
  return h('div.setting-row', h('div.setting-row__text', h('span.setting-row__label', label), hint ? h('span.setting-row__hint', hint) : null), h('div.setting-row__control', control));
}
