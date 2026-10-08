/**
 * Setup's go panel.
 *   fuel ≥ 1 → bottle row (the one this trip burns blinks) · big "출근하기 ⛽−1" · what you're signing up for
 *   fuel = 0 → "연료가 바닥났어요" · Lek's free refill offer (when available) · compact fuel pack rows (inline buy)
 * Intensity / fuel changes update the current mode in place. While `hold` is set (a purchase / refill is still flying
 * into this panel) the mode never switches, so the elements the animation aims at stay attached; the switch follows on
 * the next refresh, and keeps keyboard focus inside the panel.
 */
import { PALETTE } from '../../../core/config/palette';
import { INTENSITY } from '../../../core/config/traffic';
import type { PassengerLook, TrafficIntensity } from '../../../core/types/game';
import type { CatalogItem, SaveData } from '../../../core/types/save';
import { FREE_REFILL_FUEL } from '../../../logic/economy';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { button } from '../../components/button';
import { avatar } from '../../components/avatar';
import { speech } from '../../components/speech';
import { pop, stagger } from '../../core/animate';
import { fuelPackRow } from '../shop/shop-fuel';
import type { ShopCard, ShopCardHooks } from '../shop/shop-card';

/** Lek, the khao man gai auntie next to the Soi 23 win stand */
const LEK_LOOK: PassengerLook = { skin: PALETTE.skin2, shirt: PALETTE.taxiYellow, pants: PALETTE.carNavy, hair: 'hair_bun', hairColor: PALETTE.hairBlack };

export interface GoHooks extends ShopCardHooks {
  go(btn: HTMLButtonElement): void;
  refill(btn: HTMLButtonElement): void;
}

export interface GoState {
  save: SaveData;
  intensity: TrafficIntensity;
  districtLabel: string;
  freeRefill: boolean;
  /** keep the current mode (fuel tokens / coins are still landing on its elements) */
  hold?: boolean;
}

export interface GoPanel {
  el: HTMLElement;
  refresh(s: GoState): void;
  /** primary action of the current mode (go button, refill button or first pack) */
  focusMain(): void;
}

const subText = (s: GoState): string => `${INTENSITY[s.intensity].label} · ${s.districtLabel}`;
const countText = (fuel: number): string => `${fuel} → ${fuel - 1}`;

function bottles(fuel: number): HTMLElement {
  const shown = Math.min(fuel, 8);
  const row: Array<SVGSVGElement | HTMLElement> = [];
  for (let i = 0; i < shown; i++) row.push(icon('fuel', 18, { class: i === shown - 1 ? 's-go__bottle is-spend' : 's-go__bottle' }));
  if (fuel > shown) row.push(h('span.s-go__more.t-num', `+${fuel - shown}`));
  return h('span.s-go__bottles', row);
}

export function goPanel(packs: readonly CatalogItem[], hooks: GoHooks): GoPanel {
  const el = h('section.s-go', { aria: { live: 'polite' } });
  let mode = '';
  let main: HTMLElement | null = null;
  let rows: ShopCard[] = [];
  let live: { sub: Element | null; tank: HTMLElement; count: HTMLElement } | null = null;

  const ready = (s: GoState): HTMLElement[] => {
    const go = button({ label: '출근하기', sub: subText(s), icon: 'play', size: 'xl', block: true, key: 'Enter', autofocus: true, class: 's-go__btn', onClick: () => hooks.go(go) });
    go.insertBefore(h('span.s-go__cost', icon('fuel', 16), '−1'), go.querySelector('.btn__key'));
    main = go;
    const tank = h('span.s-go__tank-slot', bottles(s.save.fuel));
    const count = h('span.s-go__count.t-num', countText(s.save.fuel));
    live = { sub: go.querySelector('.btn__sub'), tank, count };
    return [
      h('div.s-go__tank', h('span.s-go__label', '연료'), tank, count),
      go,
      h('p.s-go__note', '연료 1병으로 gram 콜을 한 건 받아요. 도착하면 요금 + 팁 정산!'),
    ];
  };

  const empty = (s: GoState): HTMLElement[] => {
    rows = packs.map((p) => fuelPackRow(p, s.save, packs, hooks, true));
    const out: HTMLElement[] = [
      h('div.s-go__empty', icon('fuel', 26), h('div', h('h3.s-go__title', '연료가 바닥났어요'), h('p.s-go__sub', s.freeRefill ? '렉 이모가 도와준대요!' : '연료를 채워야 출근할 수 있어요'))),
    ];
    main = null;
    if (s.freeRefill) {
      const claim = button({ label: '무료 주유 받기', icon: 'fuel', variant: 'sun', block: true, autofocus: true, sfx: 'coin', onClick: () => hooks.refill(claim) });
      claim.append(h('span.s-go__gift.t-num', `+${FREE_REFILL_FUEL}`));
      main = claim;
      out.push(
        h(
          'div.s-lek',
          h('div.s-lek__who', avatar(LEK_LOOK, 'lg'), h('span.s-lek__name', '렉 이모'), h('span.s-lek__th.t-thai', { lang: 'th' }, 'ป้าเล็ก')),
          h('div.s-lek__talk', h('span.s-lek__kicker', '렉 이모의 응원 – 무료 주유'), speech(`힘내, ${s.save.loadout.nickname}! 이번엔 이모가 채워 줄게`, 'happy'), claim),
        ),
      );
    }
    out.push(h('div.s-go__packs', rows.map((r) => r.el)));
    return out;
  };

  const focusMain = (): void => {
    (main ?? rows[0]?.el.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  };

  return {
    el,
    refresh(s) {
      const next = s.save.fuel > 0 ? 'ready' : `empty:${s.freeRefill}`;
      if (next === mode || (s.hold && mode)) {
        rows.forEach((r) => r.refresh(s.save));
        if (live) {
          if (live.sub) live.sub.textContent = subText(s);
          live.tank.replaceChildren(bottles(s.save.fuel));
          live.count.textContent = countText(s.save.fuel);
        }
        return;
      }
      const wasEmpty = mode.startsWith('empty');
      const active = document.activeElement;
      const keepFocus = mode !== '' && (!active || active === document.body || el.contains(active));
      mode = next;
      rows = [];
      live = null;
      el.classList.toggle('is-empty', s.save.fuel <= 0);
      el.replaceChildren(...(s.save.fuel > 0 ? ready(s) : empty(s)));
      if (wasEmpty && s.save.fuel > 0 && main) pop(main, { from: 0.85 });
      if (s.save.fuel <= 0) stagger(el.children, { step: 50, delay: 0 });
      if (keepFocus) focusMain();
    },
    focusMain,
  };
}
