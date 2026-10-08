/**
 * Showroom caption over the transparent turntable side: save state chip · bike name (big italic) · the parts being
 * previewed (paint dot + names) · licence plate with the nickname. Plus the "drag to rotate · A D" hint pill.
 */
import { BIKES } from '../../../core/config/bikes';
import { colorHex, itemById } from '../../../core/config/catalog';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { chip, keycap } from '../../components/chip';
import { bump } from '../../core/animate';
import { licensePlate } from './garage-plate';
import type { GarageModel } from './garage-model';

export interface Showcase {
  el: HTMLElement;
  hint: HTMLElement;
  refresh(model: GarageModel): void;
  celebrate(): void;
}

const nameOf = (id: string): string => itemById(id)?.name ?? '';

function part(hex: string, text: string): HTMLElement {
  return h('span.g-show__part', h('span.g-show__dot', { style: { '--swatch': hex } }), text);
}

export function showcase(model: GarageModel): Showcase {
  const status = h('span.g-show__status');
  const bike = h('h2.g-show__bike');
  const parts = h('div.g-show__parts');
  const plate = licensePlate(model.preview.nickname, 'md');
  const el = h('div.g-show', { aria: { live: 'polite' } }, status, bike, parts, plate.el);
  const hint = h(
    'div.g-hint',
    { aria: { hidden: true } },
    icon('arrow-left', 16),
    h('span', '드래그해서 돌려보기'),
    keycap('A', 'sm'),
    keycap('D', 'sm'),
    icon('arrow-right', 16),
  );
  let statusKey = '';

  const refresh = (m: GarageModel): void => {
    const lo = m.preview;
    bike.textContent = BIKES[lo.bike].name;
    const list = [
      part(colorHex(lo.bikeColor), nameOf(lo.bikeColor)),
      part(colorHex(lo.helmetColor), nameOf(`helmet:${lo.helmet}`)),
      part(colorHex(lo.outfitColor), nameOf(`outfit:${lo.outfit}`)),
      lo.gear !== 'none' ? part(colorHex(lo.gearColor), nameOf(`gear:${lo.gear}`)) : null,
    ].filter((x): x is HTMLElement => !!x);
    parts.replaceChildren(...list);
    plate.set(lo.nickname || m.save.loadout.nickname);
    const changes = m.changes();
    const unowned = m.unowned().length;
    const key = `${changes}:${unowned}`;
    if (key === statusKey) return;
    statusKey = key;
    status.replaceChildren(
      changes === 0
        ? chip({ text: '장착 완료', tone: 'good', icon: 'check', size: 'sm' })
        : unowned > 0
          ? chip({ text: `미리보기 · 미보유 ${unowned}개`, tone: 'warn', live: true, size: 'sm' })
          : chip({ text: `미리보기 · 변경 ${changes}개`, tone: 'info', live: true, size: 'sm' }),
    );
  };
  refresh(model);
  return { el, hint, refresh, celebrate: () => void bump(el, 0.05) };
}
