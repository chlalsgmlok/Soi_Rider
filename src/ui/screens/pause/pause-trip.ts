/**
 * Pause: current-trip card built from the HUD's last snapshot (ui.hud.snapshot) — gram header with the trip number
 * and phase, the passenger, distance / time left / ride time, the comfort face + bar, and the road sign.
 * Styling: pause.css.
 */
import type { HudState } from '../../../core/types/hud';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { avatar } from '../../components/avatar';
import { chip } from '../../components/chip';
import { meter, comfortTone } from '../../components/bars';
import { comfortFace } from '../../components/face';
import { soiPlate } from '../../components/street';
import { PHASE_TEXT, TRAIT } from '../../hud/labels';
import { fmtClock, fmtDistance } from '../../hud/format';
import { gramBadge } from '../intro/gram-brand';

function stat(label: string, value: string, unit: string, tone?: 'late'): HTMLElement {
  return h('div.pause-stat', { class: tone && `pause-stat--${tone}` }, h('span.pause-stat__label', label), h('span.pause-stat__value.t-num', value, unit ? h('small', unit) : null));
}

function passengerRow(st: HudState): HTMLElement {
  const p = st.passenger;
  if (!p) return h('div.pause-trip__pax.is-empty', h('span.pause-trip__ping', icon('phone', 18)), h('span', '콜 연결 중…'));
  const trait = TRAIT[p.trait];
  return h(
    'div.pause-trip__pax',
    avatar(p.look, 'md'),
    h('div.pause-trip__who', h('b.u-ellipsis', p.name), h('span', icon('star', 12), p.rating.toFixed(1), ' · ', p.origin)),
    chip({ text: trait.label, tone: trait.tone, icon: trait.icon, size: 'sm', solid: true }),
  );
}

export function pauseTripCard(st: HudState): HTMLElement {
  const dist = fmtDistance(st.targetMeters);
  const late = st.etaLeftSec < 0;
  const eta = stat(late ? '지연' : '남은 시간', `${late ? '+' : ''}${fmtClock(st.etaLeftSec)}`, '', late ? 'late' : undefined);
  const comfort = Math.round(st.comfort);
  const face = comfortFace(comfort, 26);
  const bar = meter({ value: comfort / 100, tone: comfortTone(comfort), paper: true, label: '승차감' });
  return h(
    'div.pause-trip',
    h(
      'div.pause-trip__head',
      gramBadge('sm'),
      h('span.pause-trip__no.t-num', `TRIP ${String(st.tripNumber).padStart(2, '0')}`),
      h('span.pause-trip__phase', h('i'), PHASE_TEXT[st.phase]),
    ),
    passengerRow(st),
    h('div.pause-trip__stats', stat('남은 거리', dist.num, dist.unit), eta, stat('운행 시간', fmtClock(st.elapsedSec), '')),
    st.passenger ? h('div.pause-trip__comfort', face.el, h('span.pause-trip__comfort-label', '승차감'), bar.el, h('b.t-num', String(comfort))) : null,
    h('div.pause-trip__road', soiPlate({ en: st.district || 'BANGKOK', size: 'mini' }), h('span.u-ellipsis', st.roadName)),
  );
}
