/** Pause: riding controls legend (keyboard), shown as a glass strip under the sheet. Data table + one builder. */
import { h } from '../../core/h';
import { keycap } from '../../components/chip';

const CONTROLS: ReadonlyArray<{ keys: string[]; label: string }> = [
  { keys: ['W', 'S'], label: '가속 · 브레이크' },
  { keys: ['A', 'D'], label: '조향' },
  { keys: ['Space'], label: '움츠리기' },
  { keys: ['E'], label: '상호작용' },
  { keys: ['C'], label: '카메라' },
  { keys: ['H'], label: '경적' },
];

export function controlsLegend(): HTMLElement {
  return h(
    'div.pause-legend',
    { aria: { label: '조작법' } },
    h('span.pause-legend__title', '조작법'),
    CONTROLS.map((c) => h('span.pause-legend__item', c.keys.map((k) => keycap(k, 'sm', true)), h('span', c.label))),
  );
}
