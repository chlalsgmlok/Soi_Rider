/**
 * "오늘의 방콕" forecast card: district street plate (Thai/English), a little sky window for the time of day, the base
 * weather + downpour odds for the chosen intensity, the one-line summary, and 다시 굴리기 with the rerolls left.
 */
import type { TrafficIntensity } from '../../../core/types/game';
import type { Forecast } from '../../../core/types/screens';
import { DISTRICTS } from '../../../world/districts';
import { TOD_LABEL, forecastForIntensity } from '../../../logic/forecast';
import { DOWNPOUR_CHANCE } from '../../../logic/weather-plan';
import { h } from '../../core/h';
import { icon, type IconName } from '../../icons/icon';
import { button } from '../../components/button';
import { chip, setChipText } from '../../components/chip';
import { sectionHead } from '../../components/card';
import { soiPlate } from '../../components/street';
import { pop } from '../../core/animate';

const SKY: Record<Forecast['weather']['base'], { label: string; icon: IconName }> = {
  clear: { label: '맑음', icon: 'sun' },
  haze: { label: '연무 · 매연', icon: 'haze' },
  overcast: { label: '흐림', icon: 'cloud' },
};

export interface ForecastCard {
  el: HTMLElement;
  reroll: HTMLButtonElement;
  set(f: Forecast, intensity: TrafficIntensity, animate?: boolean): void;
}

export function forecastCard(f: Forecast, intensity: TrafficIntensity, onReroll: (btn: HTMLButtonElement) => void): ForecastCard {
  const trip = chip({ text: '', num: true, size: 'sm', tone: 'info' });
  const plateSlot = h('div.s-fc__plate');
  const sky = h('div.s-sky');
  const wx = h('div.s-wx');
  const summary = h('p.s-fc__summary');
  const reroll = button({ label: '다시 굴리기', icon: 'dice', variant: 'secondary', size: 'sm', onClick: () => onReroll(reroll) });
  const left = h('span.s-fc__left');
  const el = h(
    'section.s-fc',
    { aria: { label: '오늘의 방콕 예보' } },
    sectionHead('Today · วันนี้', '오늘의 방콕 예보', trip),
    h('div.s-fc__row', plateSlot, sky, wx),
    summary,
    h('div.s-fc__foot', reroll, left, h('span.s-fc__key', h('span.keycap.keycap--sm', 'R'))),
  );

  const set = (next: Forecast, i: TrafficIntensity, animate = false): void => {
    const d = DISTRICTS[next.district].label;
    setChipText(trip, `TRIP ${String(next.tripNumber).padStart(2, '0')}`);
    plateSlot.replaceChildren(h('span.s-fc__kicker', '지역'), soiPlate({ th: d.th, en: d.en, size: 'md' }), h('span.s-fc__ko', next.districtLabel));
    const night = next.timeOfDay === 'night';
    sky.className = `s-sky s-sky--${next.timeOfDay}`;
    sky.replaceChildren(h('span.s-sky__window', h('span.s-sky__orb', icon(night ? 'moon' : 'sun', 22))), h('span.s-sky__label', TOD_LABEL[next.timeOfDay]));
    const base = SKY[next.weather.base];
    const glyph: IconName = next.weather.base === 'clear' && night ? 'moon' : base.icon;
    wx.className = `s-wx s-wx--${next.weather.base}`;
    wx.replaceChildren(
      h('span.s-wx__main', icon(glyph, 22), h('span', base.label)),
      h('span.s-wx__rain', icon('rain', 15), `소나기 ${Math.round(DOWNPOUR_CHANCE[i] * 100)}%`),
    );
    summary.textContent = forecastForIntensity(next, i).summary;
    const leftN = next.rerollsLeft;
    reroll.disabled = leftN <= 0;
    left.textContent = leftN > 0 ? `무료 ${leftN}회 남음` : '오늘은 다 굴렸어요';
    left.classList.toggle('is-out', leftN <= 0);
    if (animate) {
      pop(sky, { from: 0.7 });
      pop(wx, { from: 0.7, delay: 60 });
      pop(plateSlot, { from: 0.8, delay: 120 });
    }
  };
  set(f, intensity);
  return { el, reroll, set };
}
