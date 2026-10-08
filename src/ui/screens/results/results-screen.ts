/**
 * RESULTS — the gram receipt prints in, score lines count up one by one (ui:sfx 'count'), the grade stamp slams with
 * an ink splash, NEW BEST pops, the passenger's stars fill and their comment appears, then 요금 + 팁 + 보너스 count to
 * the baht total and coins fly into the wallet chip. Enter / Space / Esc / click fast-forwards; afterwards the
 * buttons (다음 콜 받기 · 차고·상점 · 타이틀) take focus. A failed run shows the reason and pays ฿0.
 */
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { keycap } from '../../components/chip';
import { wallet } from '../../components/wallet';
import { flyCoins } from '../../components/coin';
import { pop, slideIn, stagger } from '../../core/animate';
import { Sequencer } from './sequencer';
import { resultsReceipt } from './results-receipt';
import { gradeMark } from './results-stamp';
import { resultsSide } from './results-side';
import { fitStage } from './stage-fit';
import './results.css';
import './results-receipt.css';

const SKIP_KEYS = new Set(['Enter', 'NumpadEnter', ' ', 'Escape']);

/** at most one call per `gap` ms (count ticks would otherwise fire every frame) */
function throttle(fn: () => void, gap: number): () => void {
  let last = 0;
  return () => {
    const now = performance.now();
    if (now - last >= gap) {
      last = now;
      fn();
    }
  };
}

export function mountResults(ctx: ScreenContext<'results'>): ScreenView<'results'> {
  const p = ctx.props();
  const r = p.result;
  const failed = r.stats.failed !== null;
  const seq = new Sequencer();
  const slip = resultsReceipt(r);
  const mark = gradeMark(r.grade);
  slip.stampSlot.append(mark.el);
  const side = resultsSide(p);
  const baht = wallet('baht', Math.max(0, p.save.baht - r.totalBaht));
  const fuel = wallet('fuel', p.save.fuel);
  const skip = h('div.res-skip', keycap('Enter', 'sm', true), h('span', '또는 화면을 눌러 건너뛰기'));
  const stage = h('div.results__stage', h('div.res-col', slip.el), side.el);
  ctx.el.append(
    h(
      'div.results',
      { class: failed && 'is-failed' },
      h('div.results__shade'),
      h('div.results__wallets', baht.el, fuel.el),
      stage,
      skip,
    ),
  );
  const unfit = fitStage(stage, { padY: 8, padX: 12, min: 0.7 });

  let running = false;
  let done = false;
  const tick = throttle(() => ctx.ui.sfx('count'), 55);
  const coinTick = throttle(() => ctx.ui.sfx('coin'), 70);

  function payout(): void {
    if (r.totalBaht <= 0) return;
    if (seq.fast) {
      void baht.set(p.save.baht);
      return;
    }
    const n = Math.max(5, Math.min(14, Math.round(r.totalBaht / 18)));
    let landed = false;
    void flyCoins(slip.payTotal, baht.target, n, {
      step: 60,
      onLand: () => {
        coinTick();
        if (landed) baht.bump();
        else void baht.set(p.save.baht, { animate: true, duration: 120 + n * 60 });
        landed = true;
      },
    });
  }

  /** focus 다음 콜 받기; retried on the next frames in case a style change still holds it unfocusable */
  function focusPrimary(tries = 12): void {
    if (seq.disposed || side.actions.contains(document.activeElement)) return;
    side.primary.focus({ preventScroll: true });
    if (document.activeElement !== side.primary && tries > 0) requestAnimationFrame(() => focusPrimary(tries - 1));
  }

  function finish(): void {
    running = false;
    done = true;
    skip.classList.add('is-gone');
    side.comment.classList.remove('is-pending');
    side.best?.classList.add('is-in');
    side.actions.classList.remove('is-pending');
    stagger([side.primary, ...side.actions.querySelectorAll('.res-actions__row .btn')], { delay: 40, step: 70 });
    focusPrimary();
  }

  async function run(): Promise<void> {
    running = true;
    void seq.play(slideIn(slip.el, 'bottom', { distance: 70, spring: { k: 190, c: 21 } }));
    await seq.wait(380);
    await slip.revealScore(seq, tick);
    await seq.wait(120);
    ctx.ui.sfx('stamp');
    await seq.play(mark.slam(slip.el, seq.fast));
    if (side.best) {
      side.best.classList.add('is-in');
      ctx.ui.sfx('ping');
      void seq.play(pop(side.best, { from: 0.3, spring: { k: 480, c: 15 } }));
    }
    await seq.wait(160);
    await side.fillStars(seq, tick);
    side.comment.classList.remove('is-pending');
    void seq.play(pop(side.comment, { from: 0.85 }));
    await seq.wait(200);
    await slip.revealPay(seq, tick);
    payout();
    await seq.wait(200);
    finish();
  }

  ctx.el.addEventListener('pointerdown', (e) => {
    if (running && !(e.target as Element | null)?.closest('.btn')) seq.skip();
  });
  ctx.onDispose(() => {
    seq.dispose();
    unfit();
  });

  return {
    enter() {
      slideIn(side.el, 'right', { distance: 40, delay: 120 });
      void run();
    },
    key(e) {
      if (running) {
        if (!SKIP_KEYS.has(e.key)) return false;
        seq.skip();
        return true;
      }
      if (!done || (e.key !== 'Enter' && e.key !== 'NumpadEnter')) return false;
      // a held skip key must not also take the next call; otherwise Enter is 다음 콜 받기 (its keycap) even when
      // focus wandered off the buttons (background click)
      if (e.repeat) return true;
      if (side.actions.contains(document.activeElement)) return false;
      side.primary.click();
      return true;
    },
    back() {
      if (running) seq.skip();
      return true;
    },
  };
}
