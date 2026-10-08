/**
 * Boot / loading progress as a little road: the cyan route fills, the rider puck drives along it.
 *   const road = loaderRoad(0);  road.set(0.62);   (Boot screen: drive it from BootProps.progress)
 * Styling: .loader-road in styles/components/feedback.css.
 */
import { h } from '../core/h';
import { icon } from '../icons/icon';

export interface LoaderRoad {
  el: HTMLElement;
  set(progress01: number): void;
}

export function loaderRoad(progress = 0, label = '로딩'): LoaderRoad {
  const el = h(
    'div.loader-road',
    { role: 'progressbar', aria: { label, valuemin: 0, valuemax: 100 } },
    h('div.loader-road__fill'),
    h('div.loader-road__rider', icon('bike', 34)),
  );
  let last = -1;
  const set = (v: number): void => {
    const p = Math.max(0, Math.min(1, v));
    if (Math.abs(p - last) < 0.001) return;
    last = p;
    el.style.setProperty('--v', p.toFixed(4));
    el.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  };
  set(progress);
  return { el, set };
}
