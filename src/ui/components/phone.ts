/**
 * The rider's handset running gram.
 *   const p = phoneFrame({ width: 340 });  p.screen.append(gramBar(chip({ text: '온라인', live: true })), …)
 *   phoneFrame({ mini: true }) → compact HUD variant (no status bar / island).
 * Styling: styles/components/phone.css.
 */
import { h, type Child, type ClassValue } from '../core/h';
import { icon } from '../icons/icon';

export interface PhoneOpts {
  mini?: boolean;
  /** CSS width (px number or any length); height follows 9:19.5 unless free */
  width?: number | string;
  /** free height (content-sized) */
  free?: boolean;
  /** clock text in the status bar (default local HH:MM) */
  time?: string;
  class?: ClassValue;
}

export interface PhoneFrame {
  el: HTMLElement;
  screen: HTMLElement;
  setTime(text: string): void;
}

const hhmm = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function phoneFrame(o: PhoneOpts = {}, ...content: Child[]): PhoneFrame {
  const timeEl = h('span.t-num', o.time ?? hhmm());
  const status = o.mini
    ? null
    : h('div.phone__status', timeEl, h('span.phone__status-icons', icon('route', 14), h('span.t-num', '5G'), batteryGlyph()));
  const screen = h('div.phone__screen', status, ...content);
  const el = h(
    'div.phone',
    {
      class: [o.mini && 'phone--mini', o.free && 'phone--free', o.class],
      style: o.width !== undefined ? { '--phone-w': typeof o.width === 'number' ? `${o.width}px` : o.width } : undefined,
    },
    o.mini ? null : h('div.phone__island'),
    screen,
  );
  return {
    el,
    screen,
    setTime: (t) => {
      timeEl.textContent = t;
    },
  };
}

function batteryGlyph(): HTMLElement {
  return h('span', {
    style: { display: 'inline-block', width: '22px', height: '11px', borderRadius: '3px', border: '1.5px solid currentColor', padding: '1.5px', boxSizing: 'border-box' },
  }, h('span', { style: { display: 'block', width: '72%', height: '100%', borderRadius: '1px', background: 'currentColor' } }));
}

/** cyan gram header with the wordmark and optional right-side content */
export function gramBar(...right: Child[]): HTMLElement {
  return h('div.gram-bar', h('span.gram-logo', 'gram'), h('div.u-row', ...right));
}

/** white card inside the gram app */
export function gramCard(attrs: { selected?: boolean; class?: ClassValue } = {}, ...children: Child[]): HTMLElement {
  return h('div.gram-card', { class: [attrs.selected && 'is-selected', attrs.class] }, ...children);
}
