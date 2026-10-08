/**
 * Intro left side: the chapter tag "TRIP 03 / BANGKOK" with district + sky chips (top-left), 렉 이모's send-off
 * caption (bottom-left) and the keyboard hint pill. Styling: intro.css.
 */
import type { IntroProps } from '../../../core/types/screens';
import type { PassengerLook } from '../../../core/types/game';
import { PALETTE } from '../../../core/config/palette';
import { h } from '../../core/h';
import { chip, keycap } from '../../components/chip';
import { avatar } from '../../components/avatar';
import { auntieLine, skyChips, two } from './intro-copy';

/** 렉 이모 — khao man gai stall owner next to the win stand (GAME_DESIGN §3) */
const LEK_LOOK: PassengerLook = { skin: PALETTE.skin3, shirt: PALETTE.taxiYellow, pants: PALETTE.carNavy, hair: 'hair_bun', hairColor: PALETTE.hairBrown };

export function chapterTag(p: IntroProps): HTMLElement {
  return h(
    'div.intro-chapter',
    h('div.intro-chapter__kicker', 'TRIP', h('span.t-thai', { lang: 'th' }, 'เที่ยวที่')),
    h('div.intro-chapter__title', h('span.intro-chapter__no.t-num', two(p.tripNumber)), h('span.intro-chapter__city', '/ BANGKOK')),
    h('div.intro-chapter__rule'),
    h(
      'div.intro-chapter__chips',
      chip({ text: p.districtLabel, icon: 'map', size: 'md' }),
      skyChips(p.timeOfDay, p.weather).map((c) => chip({ text: c.text, icon: c.icon, tone: c.tone })),
    ),
  );
}

export function auntieCaption(p: IntroProps): HTMLElement {
  return h(
    'div.intro-caption',
    avatar(LEK_LOOK, 'md'),
    h(
      'div.intro-caption__body',
      h('div.intro-caption__who', h('b', '렉 이모'), h('span', '카오만까이 노점 · ', h('span.t-thai', { lang: 'th' }, 'ข้าวมันไก่'))),
      h('p.intro-caption__line', auntieLine(p)),
    ),
  );
}

export function keyHints(): HTMLElement {
  return h(
    'div.intro-keys',
    h('span.intro-keys__group', keycap('↑', 'sm', true), keycap('↓', 'sm', true), h('span', '콜 고르기')),
    h('span.intro-keys__group', keycap('Enter', 'sm', true), h('span', '수락')),
  );
}
