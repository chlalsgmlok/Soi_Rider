/**
 * Item art tiles for the garage and shop: itemArt('helmet_cat', '#F2559A', 'md') → cream tile with the painted glyph;
 * fuelArt(5) → a rack of Thai roadside petrol bottles. Markup comes from the static table in menu-art-data.ts.
 */
import './menu-shared.css';
import type { CatalogItem } from '../../../core/types/save';
import { h, s, type ClassValue } from '../../core/h';
import { FUEL_BOTTLE, ITEM_ART, type ArtKey } from './menu-art-data';

export type ArtSize = 'sm' | 'md' | 'lg';

export interface ItemArt {
  el: HTMLElement;
  setColor(hex: string): void;
  setKey(key: ArtKey): void;
}

/** catalog item → art key (null for colours and fuel, which have their own visuals) */
export function artKeyFor(item: CatalogItem): ArtKey | null {
  const ref = item.ref ?? '';
  const key = item.category === 'bike' ? `bike_${ref}` : item.category === 'gear' && ref === 'none' ? 'gear_none' : ref;
  return key in ITEM_ART ? (key as ArtKey) : null;
}

function svg(markup: string, viewBox = '0 0 48 48'): SVGSVGElement {
  const el = s('svg', { viewBox, class: 'menu-art__svg', 'aria-hidden': 'true' });
  el.innerHTML = markup; // static, trusted art table — never dynamic strings
  return el;
}

export function itemArt(key: ArtKey, hex: string, size: ArtSize = 'md', cls?: ClassValue): ItemArt {
  let current = key;
  let glyph = svg(ITEM_ART[key]);
  const el = h('span.menu-art', { class: [`menu-art--${size}`, key === 'gear_none' && 'is-none', cls], style: { '--art-c': hex } }, glyph);
  return {
    el,
    setColor(next) {
      el.style.setProperty('--art-c', next);
    },
    setKey(next) {
      if (next === current) return;
      current = next;
      const fresh = svg(ITEM_ART[next]);
      glyph.replaceWith(fresh);
      glyph = fresh;
      el.classList.toggle('is-none', next === 'gear_none');
    },
  };
}

export interface FuelRack {
  /** bottle scale (the bottle glyph is 12 × 36 at scale 1) */
  scale: number;
  /** top-left of every bottle, in the 48 × 48 art box */
  bottles: Array<{ x: number; y: number }>;
  /** one wooden shelf under each row (none for a single bottle) */
  shelves: Array<{ x: number; y: number; w: number }>;
}

/** layout of a fuel pack's rack: 1 bottle, a row of up to 6, or two rows (7–12), centred in the 48 × 48 box */
export function fuelRack(amount: number): FuelRack {
  const n = Math.max(1, Math.min(12, Math.round(amount) || 1));
  const rows = n > 6 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const scale = n === 1 ? 1.05 : rows === 2 ? 0.5 : 0.62;
  const bw = 12 * scale;
  const gap = n === 1 ? 0 : 1.2;
  const rowW = perRow * bw + (perRow - 1) * gap;
  const x0 = (48 - rowW) / 2;
  const rowH = 36 * scale;
  const top = rows === 2 ? 4 : n === 1 ? 5 : 11;
  const rowY = (r: number): number => top + r * (rowH + 2.5);
  const bottles = Array.from({ length: n }, (_, i) => ({ x: x0 + (i % perRow) * (bw + gap), y: rowY(Math.floor(i / perRow)) }));
  const shelves = n > 1 ? Array.from({ length: rows }, (_, r) => ({ x: x0 - 2, y: rowY(r) + rowH - 1, w: rowW + 4 })) : [];
  return { scale, bottles, shelves };
}

/** bottle rack art for a fuel pack (see fuelRack) */
export function fuelArt(amount: number, size: ArtSize = 'md'): HTMLElement {
  const { scale, bottles, shelves } = fuelRack(amount);
  let markup = '';
  for (const b of bottles) markup += `<g transform="translate(${b.x.toFixed(2)} ${b.y.toFixed(2)}) scale(${scale})">${FUEL_BOTTLE}</g>`;
  for (const sh of shelves) markup += `<rect class="wood" x="${sh.x.toFixed(2)}" y="${sh.y.toFixed(2)}" width="${sh.w.toFixed(2)}" height="3" rx="1"/>`;
  return h('span.menu-art.menu-art--fuel', { class: `menu-art--${size}` }, svg(markup));
}
