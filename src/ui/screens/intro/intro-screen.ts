/**
 * INTRO — the gram driver app. The phone springs up from the bottom-right, gram searches, pings "새 콜 3건", the call
 * cards stagger in under a countdown (auto-accepts the first call at zero). ↑↓ / W S / 1–3 / click select, Enter or
 * 콜 수락 accepts: the card opens a mini route view, then the phone shrinks into the HUD mini-phone spot and
 * onAccept(offerId) fires once.
 */
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { phoneFrame } from '../../components/phone';
import { pop, slideIn, stagger, popOut } from '../../core/animate';
import { EASE, reducedMotion } from '../../core/motion';
import { Sequencer } from '../results/sequencer';
import { gramAppBar, gramRadar } from './gram-brand';
import { acceptedThread, offerCard, type OfferCard } from './offer-card';
import { countdown } from './offer-countdown';
import { auntieCaption, chapterTag, keyHints } from './intro-chapter';
import { hudPhoneRect, phoneRise, phoneShrink } from './phone-motion';
import { keepInView } from './list-scroll';
import './intro.css';
import './intro-phone.css';
import './intro-cards.css';

type State = 'searching' | 'choosing' | 'accepted' | 'done';

export function mountIntro(ctx: ScreenContext<'intro'>): ScreenView<'intro'> {
  let props = ctx.props();
  let state: State = 'searching';
  let cards: OfferCard[] = [];
  let sel = 0;
  let radarDone = false;
  let unfollow = (): void => undefined;
  const seq = new Sequencer();

  const appBar = gramAppBar(props.nickname);
  const title = h('h2.gram-calls__title', '새 콜');
  const count = h('span.gram-calls__count.t-num', '0');
  const timer = countdown(props.secondsToChoose, {
    onSecond: (left) => {
      if (left > 0 && left <= 5) ctx.ui.sfx('count');
    },
    onExpire: () => void accept(0, true),
  });
  const list = h('div.gram-calls__list', { role: 'listbox', aria: { label: '새 콜 목록' } });
  const head = h('div.gram-calls__head', h('div.gram-calls__title-row', title, count), timer.el);
  const radar = gramRadar();
  const body = h('div.gram-calls', radar);
  const phone = phoneFrame({ width: 360, class: 'intro-phone' }, appBar.el, body, h('div.phone__home'));
  const chapter = chapterTag(props);
  const caption = auntieCaption(props);
  const keys = keyHints();
  const side = [chapter, caption, keys];
  ctx.el.append(h('div.intro', h('div.intro__shade'), chapter, caption, keys, h('div.intro-dock', phone.el)));

  function renderCards(): void {
    const offers = props.offers;
    sel = Math.min(sel, Math.max(0, offers.length - 1));
    cards = offers.map((offer, i) =>
      offerCard(offer, {
        index: i,
        pickupName: props.poiName(offer.pickupPoi),
        dropName: props.poiName(offer.dropPoi),
        onSelect: () => select(i, true),
        onAccept: () => accept(i, false),
      }),
    );
    list.replaceChildren(...cards.map((c) => c.el));
    count.textContent = `${offers.length}건`;
    cards.forEach((c, i) => c.setSelected(i === sel));
  }

  async function showCalls(): Promise<void> {
    radarDone = true;
    if (state !== 'searching' || props.offers.length === 0) return;
    state = 'choosing';
    renderCards();
    ctx.ui.sfx('ping');
    appBar.setStatus('새 콜 도착', 'idle');
    body.replaceChildren(head, list);
    pop(head, { from: 0.9 });
    await seq.all(stagger(cards.map((c) => c.el), { delay: 90, step: 110, distance: 26 }).map((a) => seq.play(a)));
    if (state !== 'choosing') return;
    focusSelected();
    timer.start();
  }

  function focusSelected(): void {
    cards[sel]?.el.querySelector<HTMLElement>('.offer__accept')?.focus({ preventScroll: true });
  }

  /** short windows: the call list scrolls — keep the opening card in view */
  function follow(el: HTMLElement, ms?: number): void {
    unfollow();
    unfollow = keepInView(list, el, ms);
  }

  function select(i: number, fromPointer = false): void {
    if (state !== 'choosing' || !cards.length) return;
    const next = (i + cards.length) % cards.length;
    if (next === sel && fromPointer) return;
    sel = next;
    cards.forEach((c, k) => c.setSelected(k === sel));
    if (!fromPointer) ctx.ui.sfx('hover');
    focusSelected();
    follow(cards[sel].el);
  }

  async function accept(i: number, auto: boolean): Promise<void> {
    if (state !== 'choosing' || !cards[i]) return;
    state = 'accepted';
    timer.stop();
    sel = i;
    const chosen = cards[i];
    cards.forEach((c, k) => c.setSelected(k === i));
    ctx.ui.sfx('equip');
    appBar.setStatus('운행 중 · 픽업 이동', 'busy');
    title.replaceChildren(icon('check', 18), auto ? '자동 수락!' : '콜 수락!');
    title.classList.add('is-accepted');
    count.textContent = '';
    timer.el.classList.add('is-hidden');
    const others = cards.filter((c) => c !== chosen);
    const playRoute = chosen.showRoute();
    playRoute();
    follow(chosen.el, 900);
    await seq.all([...others.map((c) => seq.play(collapse(c.el))), seq.play(pop(title, { from: 0.8 }))]);
    others.forEach((c) => c.el.remove());
    const thread = acceptedThread(chosen.offer);
    list.append(thread);
    stagger(thread.children, { delay: 120, step: 260 });
    await seq.wait(reducedMotion() ? 900 : 1700);
    await leave(chosen.offer.id);
  }

  async function leave(offerId: string): Promise<void> {
    side.forEach((el) => void seq.play(popOut(el, { to: 0.96, duration: 260 })));
    const zoom = parseFloat(getComputedStyle(phone.el).zoom) || 1;
    phone.el.style.transformOrigin = '0 0';
    await seq.play(phoneShrink(phone.el, phone.screen, hudPhoneRect(), zoom));
    state = 'done';
    ctx.props().onAccept(offerId);
  }

  ctx.onDispose(() => {
    seq.dispose();
    timer.dispose();
    unfollow();
  });

  return {
    enter() {
      void seq.play(phoneRise(phone.el, 80)).then(() => seq.wait(reducedMotion() ? 200 : 1100)).then(showCalls);
      slideIn(chapter, 'left', { distance: 36, delay: 120 });
      slideIn(caption, 'left', { distance: 36, delay: 520 });
      stagger([keys], { delay: 900 });
    },
    update(next, changed) {
      props = next;
      if (changed.offers && state === 'choosing') renderCards();
      else if (changed.offers && state === 'searching' && radarDone) void showCalls();
    },
    key(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return false;
      const k = e.key;
      const nav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'NumpadEnter', ' ', 'w', 'W', 's', 'S', '1', '2', '3'];
      if (!nav.includes(k)) return false;
      if (state !== 'choosing') return true;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') select(sel - 1);
      else if (k === 'ArrowDown' || k === 's' || k === 'S') select(sel + 1);
      else if (k === 'Enter' || k === 'NumpadEnter' || k === ' ') void accept(sel, false);
      else if (k >= '1' && k <= '3' && Number(k) <= cards.length) select(Number(k) - 1);
      return true;
    },
    back: () => true,
  };
}

/** fold a card away (height + fade) so the chosen one slides up */
function collapse(el: HTMLElement): Animation {
  const hgt = el.offsetHeight;
  return el.animate(
    [
      { height: `${hgt}px`, opacity: 1, transform: 'none', marginBottom: '0px' },
      { height: '0px', opacity: 0, transform: 'scale(.94)', marginBottom: '-8px' },
    ],
    { duration: reducedMotion() ? 1 : 320, easing: EASE.in, fill: 'forwards' },
  );
}
