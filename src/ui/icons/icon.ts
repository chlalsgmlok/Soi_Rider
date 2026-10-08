/**
 * icon('pin', 20) → <svg class="icon icon--pin"> sized 20 px, colour = currentColor.
 * Templates are parsed once per name and cloned afterwards (cheap in hot paths).
 */
import { ICONS, type IconName } from './icon-paths';

export type { IconName };
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export interface IconOpts {
  /** extra class names */
  class?: string;
  /** accessible label; without one the icon is aria-hidden (decorative) */
  label?: string;
  /** CSS colour override (otherwise currentColor) */
  color?: string;
  /** stroke width override (default 2) */
  stroke?: number;
}

const NS = 'http://www.w3.org/2000/svg';
const cache = new Map<IconName, SVGSVGElement>();

function template(name: IconName): SVGSVGElement {
  let t = cache.get(name);
  if (!t) {
    t = document.createElementNS(NS, 'svg');
    t.setAttribute('viewBox', '0 0 24 24');
    t.setAttribute('fill', 'none');
    t.setAttribute('stroke', 'currentColor');
    t.setAttribute('stroke-width', '2');
    t.setAttribute('stroke-linecap', 'round');
    t.setAttribute('stroke-linejoin', 'round');
    t.innerHTML = ICONS[name];
    cache.set(name, t);
  }
  return t;
}

export function icon(name: IconName, size = 24, opts: IconOpts = {}): SVGSVGElement {
  const el = template(name).cloneNode(true) as SVGSVGElement;
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('class', `icon icon--${name}${opts.class ? ` ${opts.class}` : ''}`);
  if (opts.color) el.style.color = opts.color;
  if (opts.stroke) el.setAttribute('stroke-width', String(opts.stroke));
  if (opts.label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', opts.label);
  } else el.setAttribute('aria-hidden', 'true');
  return el;
}

/** Swap the glyph of an existing icon element in place (keeps size/classes). */
export function setIcon(el: SVGSVGElement, name: IconName): void {
  if (el.dataset.icon === name) return;
  el.dataset.icon = name;
  el.innerHTML = ICONS[name];
  el.setAttribute('class', el.getAttribute('class')?.replace(/icon--[\w-]+/, `icon--${name}`) ?? `icon icon--${name}`);
}

/** Static markup (e.g. CSS data URIs or innerHTML templates). */
export function iconMarkup(name: IconName, size = 24): string {
  return `<svg xmlns="${NS}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}
