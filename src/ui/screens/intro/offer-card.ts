/**
 * One gram call card: passenger (avatar, name, ★rating, origin, trait chip), pickup → drop, trip distance, fare ฿,
 * a one-line peek of the passenger's note, and an expandable drawer (full note + 콜 수락 button) that opens while the
 * card is selected. On accept the drawer swaps to the mini route view. Styling: intro-cards.css.
 */
import type { JobOffer } from '../../../core/types/game';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { avatar } from '../../components/avatar';
import { chip } from '../../components/chip';
import { button } from '../../components/button';
import { TRAIT } from '../../hud/labels';
import { REPLY, distText } from './intro-copy';
import { offerRoute } from './offer-route';

export interface OfferCard {
  el: HTMLElement;
  offer: JobOffer;
  setSelected(on: boolean): void;
  /** lock into the accepted state and show the route; returns the route view's play() */
  showRoute(): () => void;
}

export interface OfferCardOpts {
  index: number;
  pickupName: string;
  dropName: string;
  onSelect(): void;
  onAccept(): void;
}

export function offerCard(offer: JobOffer, o: OfferCardOpts): OfferCard {
  const p = offer.passenger;
  const trait = TRAIT[p.trait];
  const accept = button({ label: '콜 수락', icon: 'check', size: 'sm', key: 'Enter', block: true, sfx: 'none', class: 'offer__accept', onClick: (e) => (e.stopPropagation(), o.onAccept()) });
  accept.tabIndex = -1;
  const drawer = h(
    'div.offer__drawer',
    h(
      'div.offer__drawer-inner',
      h('p.offer__note', icon('info', 14), h('span', offer.note)),
      h('div.offer__pickup', h('span', '픽업까지 ', h('b.t-num', distText(offer.approachMeters))), h('span.offer__dot'), h('span', '목적지 ', h('b.t-num', distText(offer.estMeters)))),
      accept,
    ),
  );

  const el = h(
    'div.offer',
    {
      role: 'option',
      tabindex: -1,
      data: { nav: 'skip', index: o.index, sfx: 'tap' },
      aria: { selected: false, label: `${p.name}, ${trait.label}, ${distText(offer.estMeters)}, ${offer.fareBaht}바트` },
      on: { click: () => o.onSelect() },
    },
    h(
      'div.offer__top',
      avatar(p.look, 'md'),
      h(
        'div.offer__who',
        h('div.offer__name-row', h('span.offer__name.u-ellipsis', p.name), h('span.offer__rating.t-num', icon('star', 12), p.rating.toFixed(1))),
        h('div.offer__origin-row', chip({ text: trait.label, tone: trait.tone, icon: trait.icon, size: 'sm', solid: true }), h('span.offer__origin.u-ellipsis', p.origin)),
      ),
      h('div.offer__fare', h('span.offer__fare-num.t-num', h('small', '฿'), String(offer.fareBaht)), h('span.offer__fare-cap', '요금')),
    ),
    h(
      'div.offer__trip',
      h('span.offer__stop.offer__stop--pick', h('i'), h('span.u-ellipsis', o.pickupName)),
      icon('arrow-right', 14, { class: 'offer__arrow' }),
      h('span.offer__stop.offer__stop--drop', icon('pin', 13), h('span.u-ellipsis', o.dropName)),
      h('span.offer__km.t-num', distText(offer.estMeters)),
    ),
    h('p.offer__peek', { aria: { hidden: true } }, icon('info', 12), h('span.u-ellipsis', offer.note)),
    drawer,
  );

  return {
    el,
    offer,
    setSelected(on) {
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-selected', String(on));
      accept.tabIndex = on ? 0 : -1;
    },
    showRoute() {
      const route = offerRoute(offer, o.pickupName);
      el.classList.add('is-accepted');
      drawer.firstElementChild?.replaceWith(h('div.offer__drawer-inner', route.el));
      return route.play;
    },
  };
}

/** chat thread under the accepted card: gram's "on my way" notice + the passenger's reply */
export function acceptedThread(offer: JobOffer): HTMLElement {
  const p = offer.passenger;
  return h(
    'div.gram-thread',
    h('div.gram-thread__sys', icon('check', 12), '손님에게 출발 알림을 보냈어요'),
    h('div.gram-thread__msg', avatar(p.look, 'sm'), h('p.gram-thread__bubble', h('b', p.name), REPLY[p.trait])),
  );
}
