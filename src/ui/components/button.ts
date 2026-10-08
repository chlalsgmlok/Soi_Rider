/**
 * button({ label: '출근하기', icon: 'play', variant: 'primary', size: 'lg', key: 'Enter', onClick })
 * Locked purchasables: button({ label: '구매', locked: true, price: 450, affordable: true }).
 * Styling: .btn in styles/components/buttons.css.
 */
import type { UiSfx } from '../../core/events';
import { h, type ClassValue } from '../core/h';
import { icon, type IconName } from '../icons/icon';
import { shake } from '../core/animate';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sun' | 'paper';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonOpts {
  label?: string;
  /** small second line under the label */
  sub?: string;
  icon?: IconName;
  iconRight?: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  pill?: boolean;
  /** keyboard hint shown as a keycap at the end ("E", "Enter", "Esc") */
  key?: string;
  /** price in ฿ shown in a coin pill */
  price?: number;
  locked?: boolean;
  /** with locked: highlight that the player can afford it */
  affordable?: boolean;
  disabled?: boolean;
  autofocus?: boolean;
  /** ui sound on press (default 'tap'); 'none' silences */
  sfx?: UiSfx | 'none';
  /** accessible name for icon-only buttons */
  title?: string;
  class?: ClassValue;
  onClick?: (e: MouseEvent) => void;
}

export function button(o: ButtonOpts): HTMLButtonElement {
  const iconOnly = !o.label && !!o.icon;
  const size = o.size && o.size !== 'md' ? `btn--${o.size}` : null;
  const iconPx = o.size === 'sm' ? 18 : o.size === 'lg' ? 24 : o.size === 'xl' ? 28 : 20;
  return h(
    'button',
    {
      type: 'button',
      class: [
        'btn',
        `btn--${o.variant ?? 'primary'}`,
        size,
        o.block && 'btn--block',
        o.pill && 'btn--pill',
        iconOnly && 'btn--icon',
        o.locked && 'is-locked',
        o.locked && o.affordable && 'is-affordable',
        o.class,
      ],
      disabled: o.disabled ?? false,
      data: { sfx: o.sfx, autofocus: o.autofocus ? '' : undefined },
      aria: { label: o.title ?? (iconOnly ? o.label : undefined) },
      title: o.title,
      on: o.onClick ? { click: o.onClick } : undefined,
    },
    o.locked && !o.icon ? icon('lock', iconPx, { class: 'btn__icon' }) : null,
    o.icon ? icon(o.icon, iconPx, { class: 'btn__icon' }) : null,
    o.label ? h('span.btn__label', o.label, o.sub ? h('span.btn__sub', o.sub) : null) : null,
    o.price !== undefined ? h('span.btn__price', h('span.coin'), o.price.toLocaleString('en-US')) : null,
    o.iconRight ? icon(o.iconRight, iconPx, { class: 'btn__icon' }) : null,
    o.key ? h('span.keycap.keycap--sm.btn__key', o.key) : null,
  );
}

/** busy shimmer while an async action resolves */
export function setBusy(btn: HTMLButtonElement, busy: boolean): void {
  btn.classList.toggle('is-busy', busy);
  btn.setAttribute('aria-busy', String(busy));
}

/** deny feedback (can't afford / not allowed): shake + caller should also emit ui:sfx 'deny' */
export function denyButton(btn: HTMLElement): void {
  shake(btn, 7);
}
