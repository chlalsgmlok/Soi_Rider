/**
 * Bangkok street motifs as elements (DESIGN_SYSTEM principle 3 — every screen uses at least one):
 *   soiPlate({ th: 'ซอย สุขุมวิท 23', en: 'Sukhumvit Soi 23', no: '23' })  — blue street-sign header
 *   curbDivider() · crosswalkBand() · scallop('tuk')
 * Styling: styles/components/surfaces.css.
 */
import { h, type ClassValue } from '../core/h';

export interface SoiPlateOpts {
  en: string;
  th?: string;
  /** small white number tab in the corner */
  no?: string | number;
  size?: 'mini' | 'md' | 'lg';
  green?: boolean;
  class?: ClassValue;
}

export function soiPlate(o: SoiPlateOpts): HTMLDivElement {
  return h(
    'div.soi-plate',
    { class: [o.size && o.size !== 'md' && `soi-plate--${o.size}`, o.green && 'soi-plate--green', o.class] },
    o.th ? h('span.soi-plate__th.t-thai', { lang: 'th' }, o.th) : null,
    h('span.soi-plate__en', o.en),
    o.no !== undefined ? h('span.soi-plate__no', String(o.no)) : null,
  );
}

export function curbDivider(variant: 'default' | 'thin' | 'vertical' | 'amber' = 'default'): HTMLDivElement {
  const cls = variant === 'thin' ? 'curb-divider--thin' : variant === 'vertical' ? 'curb-divider--v' : variant === 'amber' ? 'curb-divider--amber' : null;
  return h('div.curb-divider', { class: cls, role: 'separator' });
}

export function crosswalkBand(opts: { moving?: boolean; ink?: boolean } = {}): HTMLDivElement {
  return h('div.crosswalk.crosswalk--band', { class: [opts.moving && 'crosswalk--moving', opts.ink && 'crosswalk--ink'], aria: { hidden: true } });
}

export function scallop(color: 'tuk' | 'cyan' | 'pink' = 'tuk'): HTMLDivElement {
  return h('div.scallop', { class: color !== 'tuk' && `scallop--${color}`, aria: { hidden: true } });
}
