/**
 * Illustrated traffic-density meter: a two-lane asphalt strip with toy Bangkok taxis, vans and motorbikes crawling along
 * at the intensity's flow speed (fast & sparse → bumper-to-bumper). Pure CSS motion (killed under reduced motion).
 */
import type { TrafficIntensity } from '../../../core/types/game';
import { h, s } from '../../core/h';

const CAR =
  '<path class="body" d="M2 10.5V8.6c0-1.2.9-2.1 2.1-2.2L7.6 6l3.2-3.4c.5-.5 1.1-.8 1.8-.8h6.7c.8 0 1.5.4 2 1L24 6.2l2.6.6c1 .2 1.7 1.1 1.7 2.1v1.6z"/>' +
  '<path class="win" d="M12 3.2h7l2.4 3H9.3z"/><circle class="wh" cx="8" cy="10.8" r="2.4"/><circle class="wh" cx="22.5" cy="10.8" r="2.4"/>';
const TAXI = `${CAR}<rect class="sign" x="13" y="0" width="5" height="1.8" rx=".6"/>`;
const MOTO =
  '<circle class="wh" cx="4" cy="11" r="2.3"/><circle class="wh" cx="14" cy="11" r="2.3"/><path class="body" d="M3 9.6 6.8 7h4.4l3.3 2.6z"/>' +
  '<path class="rider" d="M7.6 4.4h2.6l1 3.6H7z"/><circle class="head" cx="9" cy="2.8" r="2"/>';

type Glyph = 'taxi' | 'car' | 'moto';
const MARKUP: Record<Glyph, { svg: string; box: string; w: number }> = {
  taxi: { svg: TAXI, box: '0 0 30 14', w: 30 },
  car: { svg: CAR, box: '0 0 30 14', w: 30 },
  moto: { svg: MOTO, box: '0 0 18 14', w: 18 },
};
const PAINTS = ['pink', 'green', 'mango', 'tuk', 'cream', 'coral'] as const;

/** per lane: c = taxi/car, m = motorbike, '.' = 14 px of open road */
const PATTERN: Record<TrafficIntensity, [string, string]> = {
  light: ['c.......m.........c......', '....c........m..........'],
  rush: ['c.cm..c.c..mc..c.m.', '.cm.c.c..mc.c.m.c..'],
  gridlock: ['ccmccmcmccmccmc', 'cmccmccmcmccmcc'],
};

function vehicle(kind: Glyph, paint: string): SVGSVGElement {
  const m = MARKUP[kind];
  const el = s('svg', { viewBox: m.box, width: m.w, height: 14, class: `s-veh s-veh--${paint}`, 'aria-hidden': 'true' });
  el.innerHTML = m.svg; // static, trusted glyphs
  return el;
}

function lane(pattern: string, seed: number): HTMLElement {
  const items: Array<SVGSVGElement | HTMLElement> = [];
  let k = seed;
  for (const ch of pattern) {
    if (ch === '.') items.push(h('span.s-road__gap'));
    else {
      const paint = PAINTS[k++ % PAINTS.length];
      items.push(vehicle(ch === 'm' ? 'moto' : k % 3 === 0 ? 'car' : 'taxi', paint));
    }
  }
  const run = h('span.s-road__run', items);
  // two identical runs back to back → seamless -50% loop
  return h('div.s-road__lane', h('div.s-road__traffic', run, run.cloneNode(true)));
}

export function densityRoad(intensity: TrafficIntensity): HTMLElement {
  const [a, b] = PATTERN[intensity];
  return h(
    'div.s-road',
    { class: `s-road--${intensity}`, role: 'img', aria: { label: intensity === 'light' ? '교통량 적음' : intensity === 'rush' ? '교통량 많음' : '교통량 매우 많음' } },
    lane(a, 0),
    h('span.s-road__line'),
    lane(b, 3),
  );
}

/** chili peppers for difficulty (Thai "spicy level"), lit = level */
export function chilies(level: number, max = 3): HTMLElement {
  const out: SVGSVGElement[] = [];
  for (let i = 0; i < max; i++) {
    const el = s('svg', { viewBox: '0 0 16 16', width: 15, height: 15, class: ['s-chili', i < level && 'is-lit'], 'aria-hidden': 'true' });
    el.innerHTML = '<path class="pod" d="M3.5 5.5c2.5.5 6 3 8 7.5.5 1.2-.7 1.8-1.7 1C7 11.5 4.5 9 3 6.8z"/><path class="stem" d="M3.6 5.6c-.4-1.6.2-2.8 1.6-3.4"/>';
    out.push(el);
  }
  return h('span.s-chilies', { role: 'img', aria: { label: `난이도 ${level}/${max}` } }, out);
}
