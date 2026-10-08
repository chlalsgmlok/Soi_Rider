/**
 * Bike spec bars (최고속도 · 가속 · 핸들링 · 차폭): the bar shows the equipped bike, stripes preview the delta to the
 * bike being looked at (green = better). 차폭 is inverted — a wider bike squeezes worse, so wider shows red.
 */
import { BIKES } from '../../../core/config/bikes';
import { h } from '../../core/h';
import { statBar, type StatBar } from '../../components/bars';
import { sectionHead } from '../../components/card';
import { bikeSpec, type SpecRow } from '../shop/menu-catalog';
import type { GarageModel } from './garage-model';

export interface BikeStats {
  el: HTMLElement;
  refresh(model: GarageModel): void;
}

export function bikeStats(model: GarageModel): BikeStats {
  const rows = bikeSpec(model.save.loadout.bike);
  const bars = new Map<SpecRow['key'], StatBar>();
  for (const r of rows) {
    const bar = statBar({ label: r.label, value: r.value, display: r.display });
    bar.el.classList.toggle('is-inverse', !!r.inverse);
    bars.set(r.key, bar);
  }
  const compare = h('span.g-stats__compare');
  const el = h('section.g-stats', { aria: { label: '바이크 성능' } }, sectionHead('Spec', '성능', compare), h('div.g-stats__bars', [...bars.values()].map((b) => b.el)));

  const refresh = (m: GarageModel): void => {
    const worn = bikeSpec(m.save.loadout.bike);
    const look = bikeSpec(m.preview.bike);
    for (const r of look) {
      const base = worn.find((w) => w.key === r.key);
      bars.get(r.key)?.set(base?.value ?? r.value, r.display, r.value - (base?.value ?? r.value));
    }
    const same = m.preview.bike === m.save.loadout.bike;
    compare.textContent = same ? '장착 중인 바이크' : `${BIKES[m.save.loadout.bike].name} 대비`;
    compare.classList.toggle('is-compare', !same);
  };
  refresh(model);
  return { el, refresh };
}
