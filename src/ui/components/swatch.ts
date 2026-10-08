/**
 * Colour picker cell: swatch({ hex, name, selected, locked, price, onPick }).
 * Wrap many in h('div.swatch-grid', …). Styling: styles/components/controls.css (.swatch, .swatch-cell).
 */
import { h } from '../core/h';

export interface SwatchOpts {
  hex: string;
  name: string;
  selected?: boolean;
  locked?: boolean;
  /** shown under locked swatches */
  price?: number;
  /** show the name under the dot */
  showName?: boolean;
  size?: 'md' | 'lg';
  onPick?: () => void;
}

export interface Swatch {
  el: HTMLElement;
  button: HTMLButtonElement;
  setSelected(on: boolean): void;
  setLocked(locked: boolean, price?: number): void;
}

export function swatch(o: SwatchOpts): Swatch {
  const priceText = h('span', o.price !== undefined ? String(o.price) : '');
  const priceEl = h('span.swatch-cell__price', h('span.coin'), priceText);
  const button = h('button', {
    type: 'button',
    class: ['swatch', o.size === 'lg' && 'swatch--lg', o.selected && 'is-selected', o.locked && 'is-locked'],
    style: { '--swatch': o.hex },
    title: o.name,
    aria: { label: o.locked ? `${o.name} (잠김, ${o.price ?? 0}바트)` : o.name, pressed: !!o.selected },
    data: { sfx: o.locked ? 'tap' : 'equip' },
    on: o.onPick ? { click: o.onPick } : undefined,
  });
  const el = h('div.swatch-cell', button, o.locked && o.price !== undefined ? priceEl : null, o.showName ? h('span.swatch-cell__name', o.name) : null);
  return {
    el,
    button,
    setSelected(on) {
      button.classList.toggle('is-selected', on);
      button.setAttribute('aria-pressed', String(on));
    },
    setLocked(locked, price) {
      button.classList.toggle('is-locked', locked);
      button.dataset.sfx = locked ? 'tap' : 'equip';
      if (locked && price !== undefined) {
        priceText.textContent = String(price);
        if (!priceEl.isConnected) button.after(priceEl);
      } else priceEl.remove();
    },
  };
}
