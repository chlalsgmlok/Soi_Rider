/**
 * Comfort face: a round emoji-style face whose colour and expression follow comfort 0..100
 * (≥ 80 grin · ≥ 60 smile · ≥ 45 flat · ≥ 30 worried · else upset — same 60/30 split as comfortTone). update() only rewrites on band change.
 */
import { s } from '../core/h';

const BANDS = [
  { min: 80, fill: '#34B04A', mouth: 'M7.6 13.2c2.4 2.8 6.4 2.8 8.8 0', brows: '' },
  { min: 60, fill: '#7CC242', mouth: 'M8.2 14c2.1 1.7 5.5 1.7 7.6 0', brows: '' },
  { min: 45, fill: '#F7C928', mouth: 'M8.6 14.8h6.8', brows: '' },
  { min: 30, fill: '#FFB23E', mouth: 'M8.4 16c2-1.8 5.2-1.8 7.2 0', brows: 'M7.4 8.6l2.6.9M16.6 8.6l-2.6.9' },
  { min: -1, fill: '#FF4D5E', mouth: 'M8 16.6c2.3-2.4 5.7-2.4 8 0', brows: 'M7.2 9.4l2.8-1.2M16.8 9.4L14 8.2' },
] as const;

export interface ComfortFace {
  el: SVGSVGElement;
  /** returns true when the expression band changed (for a bump animation) */
  update(value: number): boolean;
}

export function comfortFace(value: number, size = 22): ComfortFace {
  const disc = s('circle', { cx: 12, cy: 12, r: 10.5 });
  const shine = s('ellipse', { cx: 8.8, cy: 7.4, rx: 3.2, ry: 2, fill: '#fff', opacity: 0.35 });
  const eyes = s('g', { fill: '#151821' }, s('ellipse', { cx: 9, cy: 10.6, rx: 1.25, ry: 1.5 }), s('ellipse', { cx: 15, cy: 10.6, rx: 1.25, ry: 1.5 }));
  const mouth = s('path', { fill: 'none', stroke: '#151821', 'stroke-width': 1.7, 'stroke-linecap': 'round' });
  const brows = s('path', { fill: 'none', stroke: '#151821', 'stroke-width': 1.4, 'stroke-linecap': 'round' });
  const el = s('svg', { viewBox: '0 0 24 24', width: size, height: size, class: 'comfort-face', 'aria-hidden': 'true' }, disc, shine, eyes, mouth, brows);
  disc.setAttribute('stroke', 'rgba(0,0,0,.18)');
  disc.setAttribute('stroke-width', '1');
  let band = -1;
  const update = (v: number): boolean => {
    const i = BANDS.findIndex((b) => v >= b.min);
    if (i === band) return false;
    const first = band === -1;
    band = i;
    const b = BANDS[i];
    disc.setAttribute('fill', b.fill);
    mouth.setAttribute('d', b.mouth);
    brows.setAttribute('d', b.brows);
    return !first;
  };
  update(value);
  return { el, update };
}
