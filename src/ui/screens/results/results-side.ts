/**
 * Results right column: headline (grade / fail reason), NEW BEST badge, the passenger rating stars that fill one by
 * one, the passenger's comment bubble and the action buttons. Each part is revealed by results-screen through the
 * Sequencer. Styling: results.css.
 */
import type { ResultsProps } from '../../../core/types/screens';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { avatar } from '../../components/avatar';
import { speech } from '../../components/speech';
import { button } from '../../components/button';
import { pop } from '../../core/animate';
import type { Sequencer } from './sequencer';
import { FAIL_COPY, headline, passengerMood } from './results-copy';

export interface ResultsSide {
  el: HTMLElement;
  best: HTMLElement | null;
  comment: HTMLElement;
  actions: HTMLElement;
  primary: HTMLButtonElement;
  fillStars(seq: Sequencer, tick: () => void): Promise<void>;
}

function starSlot(): { el: HTMLElement; fill: HTMLElement } {
  const fill = h('span.res-star__fill', icon('star', 34));
  return { el: h('span.res-star', icon('star', 34, { class: 'res-star__base' }), fill), fill };
}

export function resultsSide(p: ResultsProps): ResultsSide {
  const r = p.result;
  const fail = r.stats.failed;
  const head = headline(r);
  const slots = Array.from({ length: 5 }, starSlot);
  const starsNum = h('b.res-rating__num.t-num', '0.0');
  const best = r.newBest ? h('span.res-best', icon('trophy', 16), 'NEW BEST', h('small', '최고 기록')) : null;

  const primary = button({ label: fail ? '다시 콜 받기' : '다음 콜 받기', icon: 'phone', size: 'xl', key: 'Enter', autofocus: true, onClick: () => p.onNext() });
  const actions = h(
    'div.res-actions.is-pending',
    primary,
    h(
      'div.res-actions__row',
      button({ label: '차고 · 상점', icon: 'helmet', variant: 'secondary', size: 'lg', onClick: () => p.onGarage() }),
      button({ label: '타이틀', icon: 'home', variant: 'ghost', size: 'lg', onClick: () => p.onTitle() }),
    ),
  );
  const comment = h('div.res-comment.is-pending', avatar(r.job.passenger.look, 'lg'), h('div.res-comment__bubble', h('span.res-comment__name', r.job.passenger.name), speech(r.passengerComment, passengerMood(r))));

  const el = h(
    'div.res-side',
    { class: fail && 'is-failed', data: { grade: r.grade } },
    h(
      'div.res-head',
      h('div.res-head__kicker', icon(fail ? 'warning' : 'flag', 16), fail ? '운행 실패' : '운행 완료', best),
      h('h1.res-head__title', head.title, ' ', h('span.res-head__accent', head.accent)),
      fail ? h('div.res-head__reason', h('span.res-head__reason-icon', icon(head.icon, 20)), FAIL_COPY[fail].title) : null,
      h('p.res-head__sub', head.sub),
    ),
    h('div.res-rating', h('div.res-rating__stars', { role: 'img', aria: { label: `손님 별점 ${r.stars} / 5` } }, slots.map((x) => x.el)), starsNum, h('span.res-rating__cap', '손님 평점')),
    comment,
    actions,
  );

  return {
    el,
    best,
    comment,
    actions,
    primary,
    async fillStars(seq, tick) {
      for (let i = 0; i < slots.length; i++) {
        const f = Math.max(0, Math.min(1, r.stars - i));
        if (f <= 0) break;
        slots[i].el.style.setProperty('--f', String(f));
        slots[i].el.classList.add('is-on');
        tick();
        void seq.play(pop(slots[i].el, { from: 0.4, spring: { k: 520, c: 16 } }));
        starsNum.textContent = Math.min(r.stars, i + f).toFixed(1);
        await seq.wait(120);
      }
      starsNum.textContent = r.stars.toFixed(1);
    },
  };
}
