/**
 * Pill tabs with a sliding cyan ink: tabStrip({ tabs: [{ id: 'bike', label: '오토바이', icon: 'bike' }], active: 'bike', onChange }).
 * Q/E (or [ / ]) switch tabs when `hotkeys` is true (wire from the screen's key() hook via handleKey).
 * Styling: styles/components/controls.css (.tab-strip, .tab, .segmented).
 */
import { h } from '../core/h';
import { icon, type IconName } from '../icons/icon';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  badge?: string | number;
}

export interface TabStrip<T extends string> {
  el: HTMLElement;
  active(): T;
  set(id: T, emit?: boolean): void;
  /** call from a screen key() hook: Q/E & [/] cycle tabs; returns true if consumed */
  handleKey(e: KeyboardEvent): boolean;
  dispose(): void;
}

export function tabStrip<T extends string>(o: {
  tabs: TabDef<T>[];
  active: T;
  onChange?: (id: T) => void;
  block?: boolean;
  segmented?: boolean;
  label?: string;
}): TabStrip<T> {
  let current = o.active;
  const ink = h('span.tab-strip__ink', { aria: { hidden: true } });
  const buttons = o.tabs.map((t) =>
    h(
      'button.tab',
      { type: 'button', role: 'tab', data: { tab: t.id }, on: { click: () => api.set(t.id, true) } },
      t.icon ? icon(t.icon, 16) : null,
      h('span', t.label),
      t.badge !== undefined ? h('span.badge.badge--new', String(t.badge)) : null,
    ),
  );
  const el = h('div.tab-strip', { class: [o.block && 'tab-strip--block', o.segmented && 'segmented'], role: 'tablist', aria: { label: o.label } }, ink, buttons);

  const place = (): void => {
    const b = buttons[o.tabs.findIndex((t) => t.id === current)];
    if (!b || !b.offsetWidth) return;
    ink.style.width = `${b.offsetWidth}px`;
    ink.style.transform = `translateX(${b.offsetLeft}px)`;
  };
  const ro = new ResizeObserver(place);
  ro.observe(el);

  const api: TabStrip<T> = {
    el,
    active: () => current,
    set(id, emit = false) {
      const changed = id !== current;
      current = id;
      buttons.forEach((b, i) => {
        const on = o.tabs[i].id === id;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      place();
      if (emit && changed) o.onChange?.(id);
    },
    handleKey(e) {
      const dir = e.key === 'q' || e.key === 'Q' || e.key === '[' ? -1 : e.key === 'e' || e.key === 'E' || e.key === ']' ? 1 : 0;
      if (!dir) return false;
      const i = o.tabs.findIndex((t) => t.id === current);
      const next = o.tabs[(i + dir + o.tabs.length) % o.tabs.length];
      api.set(next.id, true);
      buttons[o.tabs.indexOf(next)]?.focus({ preventScroll: true });
      return true;
    },
    dispose: () => ro.disconnect(),
  };
  api.set(current);
  return api;
}
