/**
 * Traffic intensity cards (한산 / 러시아워 / 극심 정체): tone band with the Thai road-sign label, Korean name, animated
 * density road, payout multiplier, ETA reference speed, chili difficulty and the best grade earned at that intensity.
 * Cards are radio buttons: click / Enter / 1-2-3 select (onIntensity lets the 3D backdrop react).
 */
import { INTENSITY } from '../../../core/config/traffic';
import type { Grade, TrafficIntensity } from '../../../core/types/game';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { gradeStamp } from '../../components/receipt';
import { chilies, densityRoad } from './setup-density';

export const INTENSITY_ORDER: readonly TrafficIntensity[] = ['light', 'rush', 'gridlock'];

const COPY: Record<TrafficIntensity, { en: string; desc: string; level: number; eta: string }> = {
  light: { en: 'Light traffic', desc: '차가 뜸해 마음껏 달려요. 요금은 기본.', level: 1, eta: '시간 여유' },
  rush: { en: 'Rush hour', desc: '퇴근길 정체. 미러 사이를 비집는 손맛!', level: 2, eta: '비집기 필수' },
  gridlock: { en: 'Gridlock', desc: '꽉 막힌 도로, 요금은 최고. 고수 전용.', level: 3, eta: '틈새 승부' },
};

/** 1 → "×1.0", 1.25 → "×1.25", 1.5 → "×1.5" */
const multiplier = (v: number): string => `×${Number.isInteger(v) ? v.toFixed(1) : String(Number(v.toFixed(2)))}`;

export interface IntensityCard {
  id: TrafficIntensity;
  el: HTMLButtonElement;
  setSelected(on: boolean): void;
}

export function intensityCard(id: TrafficIntensity, best: Grade | null, index: number, onPick: (id: TrafficIntensity, viaKeyboard: boolean) => void): IntensityCard {
  const cfg = INTENSITY[id];
  const copy = COPY[id];
  const kmh = Math.round(cfg.etaSpeed * 3.6);
  const el = h(
    'button.s-card',
    {
      type: 'button',
      role: 'radio',
      class: `s-card--${id}`,
      data: { intensity: id, sfx: 'tap' },
      aria: { checked: false, label: `${cfg.label} · 요금 ${cfg.fareMult}배 · 난이도 ${copy.level}` },
      on: { click: (e) => onPick(id, e.detail === 0) },
    },
    h(
      'span.s-card__band',
      h('span.s-card__key.keycap.keycap--sm', String(index + 1)),
      h('span.s-card__en', copy.en),
      h('span.s-card__th.t-thai', { lang: 'th' }, cfg.labelTh),
    ),
    h(
      'span.s-card__body',
      h('span.s-card__title', cfg.label),
      densityRoad(id),
      h(
        'span.s-card__facts',
        h('span.s-fact', icon('coin', 16), h('span.s-fact__k', '요금'), h('b.t-num', multiplier(cfg.fareMult))),
        h('span.s-fact', icon('clock', 16), h('span.s-fact__k', `기준 ${kmh}km/h`), h('b', copy.eta)),
        h('span.s-fact', icon('spark', 16), h('span.s-fact__k', '난이도'), chilies(copy.level)),
      ),
      h('span.s-card__desc', copy.desc),
    ),
    best ? h('span.s-card__best', gradeStamp(best, { size: 'sm', label: 'BEST · GRADE' })) : null,
    h('span.s-card__check', { aria: { hidden: true } }, icon('check', 18)),
  );
  return {
    id,
    el,
    setSelected(on) {
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-checked', String(on));
    },
  };
}
