/**
 * Inline labels: chip({ text: '급해요', tone: 'warn', icon: 'clock' }), keycap('E'), lockVeil().
 * Styling: styles/components/chips.css, surfaces.css (.lock-veil).
 */
import { h, type ClassValue } from '../core/h';
import { icon, type IconName } from '../icons/icon';

export type ChipTone = 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'pink' | 'tuk';

export interface ChipOpts {
  text: string;
  tone?: ChipTone;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  /** filled with the tone colour */
  solid?: boolean;
  /** for cream surfaces */
  paper?: boolean;
  /** pulsing status dot instead of an icon */
  live?: boolean;
  /** tabular figures in Kanit */
  num?: boolean;
  class?: ClassValue;
}

export function chip(o: ChipOpts): HTMLSpanElement {
  const tone = o.tone && o.tone !== 'neutral' ? `chip--${o.tone}` : null;
  const px = o.size === 'sm' ? 13 : o.size === 'lg' ? 18 : 16;
  return h(
    'span',
    { class: ['chip', tone, o.size && o.size !== 'md' && `chip--${o.size}`, o.solid && 'chip--solid', o.paper && 'chip--paper', o.num && 'chip--num', o.class] },
    o.live ? h('span.chip__dot.is-live') : null,
    o.icon ? icon(o.icon, px) : null,
    h('span.chip__text', o.text),
  );
}

/** update a chip's text in place (cheap; no rebuild) */
export function setChipText(el: HTMLElement, text: string): void {
  const t = el.querySelector('.chip__text');
  if (t && t.textContent !== text) t.textContent = text;
}

export function keycap(key: string, size: 'sm' | 'md' | 'lg' = 'md', dark = false): HTMLSpanElement {
  const label = key === ' ' || key === 'Space' ? 'SPACE' : key === 'Escape' ? 'ESC' : key === 'Enter' ? '↵' : key;
  return h('span', {
    class: ['keycap', size !== 'md' && `keycap--${size}`, label.length > 2 && 'keycap--wide', dark && 'keycap--dark'],
    text: label,
    aria: { label: `${key} 키` },
  });
}

/** semi-dark veil with a lock glyph, for locked cards/items (parent must be position: relative) */
export function lockVeil(): HTMLDivElement {
  return h('div.lock-veil', icon('lock', 26));
}
