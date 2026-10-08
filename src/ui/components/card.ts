/**
 * Cards & panels.
 *   card({ interactive: true, selected, locked, onClick }, …children)   — cream card (or dark with `dark`)
 *   panel({ head, foot }, …body)                                         — docked dark surface (garage/shop)
 * Interactive cards are focusable ([data-nav]) and activate with Enter / click.
 */
import { h, type Child, type ClassValue } from '../core/h';
import { lockVeil } from './chip';

export interface CardOpts {
  dark?: boolean;
  interactive?: boolean;
  selected?: boolean;
  locked?: boolean;
  label?: string;
  class?: ClassValue;
  onClick?: (e: MouseEvent) => void;
}

export function card(o: CardOpts, ...children: Child[]): HTMLDivElement {
  const el = h(
    'div.card',
    {
      class: [o.dark && 'card--dark', o.interactive && 'card--interactive', o.selected && 'is-selected', o.locked && 'is-locked', o.class],
      tabindex: o.interactive ? 0 : undefined,
      role: o.interactive ? 'button' : undefined,
      data: { nav: o.interactive ? '' : undefined },
      aria: { label: o.label, pressed: o.interactive ? !!o.selected : undefined },
      on: o.onClick ? { click: o.onClick } : undefined,
    },
    ...children,
  );
  if (o.locked) el.append(lockVeil());
  return el;
}

export function setCardSelected(el: HTMLElement, on: boolean): void {
  el.classList.toggle('is-selected', on);
  if (el.getAttribute('role') === 'button') el.setAttribute('aria-pressed', String(on));
}

export function panel(o: { head?: Child; foot?: Child; class?: ClassValue; scroll?: boolean }, ...body: Child[]): HTMLDivElement {
  return h(
    'div.panel',
    { class: o.class },
    o.head ? h('div.panel__head', o.head) : null,
    h('div.panel__body', { class: o.scroll !== false && 'scroll-y' }, ...body),
    o.foot ? h('div.panel__foot', o.foot) : null,
  );
}

export function sectionHead(kicker: string, title: string, ...right: Child[]): HTMLDivElement {
  return h('div.section-head', h('span.section-head__kicker', kicker), h('span.section-head__title', title), right.length ? h('span.u-grow') : null, ...right);
}
