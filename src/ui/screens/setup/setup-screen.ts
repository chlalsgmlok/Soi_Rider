/**
 * Setup (SetupProps): pick the traffic intensity (three big cards, 1/2/3), check "오늘의 방콕" (다시 굴리기 / R), then
 * 출근하기 (⛽−1). With an empty tank the go panel turns into fuel packs + Lek's free refill when it is available; it swaps
 * back to 출근하기 once the bought coins / Lek's bottles have landed. 출근하기 stays busy after onGo; if the screen is
 * still up GO_REARM_MS later (the app refused the run) it re-arms.
 */
import './setup.css';
import { CATALOG } from '../../../core/config/catalog';
import type { TrafficIntensity } from '../../../core/types/game';
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { denyButton, setBusy } from '../../components/button';
import { stagger } from '../../core/animate';
import { menuWallets } from '../shop/menu-wallets';
import { menuHeader } from '../shop/menu-header';
import { itemsOf } from '../shop/menu-catalog';
import { denyPurchase, flyFuel, playPurchase, soldStamp, type PurchaseFx } from '../shop/purchase-fx';
import { disarmWithin, hotkey } from '../shop/menu-keys';
import { INTENSITY_ORDER, intensityCard } from './setup-intensity';
import { forecastCard } from './setup-forecast';
import { goPanel } from './setup-go';

const pad2 = (n: number): string => String(n).padStart(2, '0');
const GO_REARM_MS = 4000;

export function mountSetup(ctx: ScreenContext<'setup'>): ScreenView<'setup'> {
  const p = ctx.props();
  let save = p.save;
  let forecast = p.forecast;
  let freeRefill = p.freeRefillAvailable;
  let intensity: TrafficIntensity = 'rush';
  let flights = 0;
  /** purchases / refills still landing on the go panel's elements: its mode swap waits for them (GoState.hold) */
  let holds = 0;
  let going: HTMLButtonElement | null = null;
  let goTimer = 0;
  const wallets = menuWallets(save);
  const fx: PurchaseFx = { ui: ctx.ui, wallets };
  /** call `flights++` BEFORE invoking an app callback (it may push handle.update synchronously), then land(animation) */
  const land = (job: Promise<void>): void => {
    void job.finally(() => {
      flights--;
      if (!flights) wallets.set(save);
    });
  };

  const refresh = (): void => go.refresh({ save, intensity, districtLabel: forecast.districtLabel, freeRefill, hold: holds > 0 });
  /** pin the go panel's current mode; the returned release (idempotent) lets it swap */
  const hold = (): (() => void) => {
    holds++;
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      holds--;
      refresh();
    };
  };
  const rearm = (): void => {
    window.clearTimeout(goTimer);
    if (going?.isConnected) setBusy(going, false);
    going = null;
  };
  ctx.onDispose(() => window.clearTimeout(goTimer));

  const pick = (id: TrafficIntensity, viaKeyboard: boolean): void => {
    const changed = id !== intensity;
    intensity = id;
    cards.forEach((c) => c.setSelected(c.id === id));
    fc.set(forecast, id);
    refresh();
    if (changed) ctx.props().onIntensity(id);
    if (viaKeyboard) go.focusMain();
  };

  const reroll = (btn: HTMLButtonElement): void => {
    const next = forecast.rerollsLeft > 0 ? ctx.props().onReroll() : null;
    if (!next) {
      ctx.ui.sfx('deny');
      denyButton(btn);
      ctx.ui.toast('오늘은 더 굴릴 수 없어요', 'warn', 'dice');
      return;
    }
    forecast = next;
    ctx.ui.sfx('swoosh');
    fc.set(next, intensity, true);
    btn.querySelector('.icon')?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
    refresh();
  };

  const cards = INTENSITY_ORDER.map((id, i) => intensityCard(id, save.bestGrade[id], i, pick));
  const fc = forecastCard(forecast, intensity, reroll);
  const go = goPanel(itemsOf(CATALOG, 'fuel'), {
    go(btn) {
      if (going || save.fuel <= 0) return;
      going = btn;
      setBusy(btn, true);
      ctx.ui.sfx('swoosh');
      ctx.props().onGo(intensity);
      goTimer = window.setTimeout(rearm, GO_REARM_MS);
    },
    refill(btn) {
      if (!freeRefill) return;
      const before = save.fuel;
      // Lek's card stays (claim button busy) until her bottles reach the ⛽ wallet, then the panel swaps to 출근하기
      const release = hold();
      flights++;
      setBusy(btn, true);
      save = ctx.props().onFreeRefill();
      freeRefill = false;
      const gained = Math.max(1, save.fuel - before);
      ctx.ui.toast(`렉 이모 덕분에 연료 +${gained}! 고마워요 이모`, 'good', 'fuel');
      land(flyFuel(btn, wallets.fuel.target, gained).then(() => ctx.ui.sfx('coin')).finally(release));
      refresh();
    },
    buy(item, pressed, card) {
      // the pack row (coin target) stays until the coins land in it; the bottles then fly from where it was
      const release = hold();
      flights++;
      const res = ctx.props().onBuyFuel(item.id);
      card.focus(); // the armed 결제 button just folded away; the swap then hands focus to 출근하기
      if (res.ok) {
        save = res.save;
        soldStamp(card.el, `연료 +${item.amount ?? 1}`);
      }
      land(playPurchase(fx, item, res, card.target, pressed, release).finally(release));
      refresh();
    },
    deny: (item, pressed) => denyPurchase(fx, item, pressed, 'funds', save.baht),
  });
  cards.forEach((c) => c.setSelected(c.id === intensity));
  refresh();

  const header = menuHeader({
    plate: { th: 'เข้างาน', en: 'Clock in', no: pad2(forecast.tripNumber) },
    title: '출근 준비',
    sub: `TRIP ${pad2(forecast.tripNumber)} · 교통 상황을 고르고 오늘의 방콕을 확인하세요`,
    onBack: () => ctx.props().onBack(),
    right: wallets.el,
  });
  const deck = h('div.setup__cards', { role: 'radiogroup', aria: { label: '교통 체증 강도' } }, cards.map((c) => c.el));
  ctx.el.append(h('div.menu-stage', h('div.setup', header, deck, h('div.setup__bottom', fc.el, go.el))));

  return {
    enter() {
      stagger([header, ...cards.map((c) => c.el), fc.el, go.el], { step: 55, delay: 40, distance: 16 });
      ctx.props().onIntensity(intensity);
    },
    update(next, changed) {
      if (changed.save && next.save !== save) {
        save = next.save;
        if (!flights) wallets.set(save);
      }
      if (changed.forecast && next.forecast !== forecast) {
        forecast = next.forecast;
        fc.set(forecast, intensity, true);
      }
      if (changed.freeRefillAvailable !== undefined) freeRefill = next.freeRefillAvailable;
      refresh();
    },
    key(e) {
      const k = hotkey(e);
      const n = k ? ['1', '2', '3'].indexOf(k) : -1;
      if (n >= 0) {
        pick(INTENSITY_ORDER[n], false);
        cards[n].el.focus({ preventScroll: true });
        return true;
      }
      if (k === 'r') {
        reroll(fc.reroll);
        return true;
      }
      return false;
    },
    back() {
      if (disarmWithin(ctx.el)) return true;
      ctx.props().onBack();
      return true;
    },
  };
}
