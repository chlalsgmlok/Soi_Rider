/**
 * PAUSE (overlay) — frosted glass sheet over the frozen ride: 계속 달리기 / 다시 시작 / 설정 / 나가기 with key hints,
 * the current trip (from ui.hud.snapshot) and the controls legend. Restart and quit ask for confirmation in a sheet.
 * Keys: Esc / P resume · R restart · Q quit (arrows + Enter move through the menu).
 */
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { button } from '../../components/button';
import { soiPlate, scallop } from '../../components/street';
import { pop, popOut, settled, slideIn, stagger } from '../../core/animate';
import { pauseTripCard } from './pause-trip';
import { controlsLegend } from './pause-hints';
import './pause.css';

export function mountPause(ctx: ScreenContext<'pause'>): ScreenView<'pause'> {
  const p = (): ReturnType<typeof ctx.props> => ctx.props();
  let asking = false;

  async function confirm(kind: 'restart' | 'quit'): Promise<void> {
    if (asking) return;
    asking = true;
    const restart = kind === 'restart';
    const sheet = ctx.ui.sheet({
      title: restart ? '처음부터 다시 달릴까요?' : '운행을 그만둘까요?',
      icon: restart ? 'refresh' : 'exit',
      body: restart ? '지금까지의 운행 기록은 사라지고, 같은 콜로 윈 스탠드에서 다시 출발해요.' : '손님이 내리고 이번 콜은 실패로 처리돼요. 사용한 연료는 돌아오지 않아요.',
      center: true,
      actions: [
        { id: 'stay', label: '계속 달리기', variant: 'paper', icon: 'play', autofocus: !restart },
        restart ? { id: 'go', label: '다시 시작', variant: 'primary', icon: 'refresh', autofocus: true } : { id: 'go', label: '나가기', variant: 'danger', icon: 'exit' },
      ],
    });
    const choice = await sheet.result;
    asking = false;
    if (choice !== 'go') return;
    if (restart) p().onRestart();
    else p().onQuit();
  }

  const resume = button({ label: '계속 달리기', icon: 'play', size: 'lg', block: true, key: 'Esc', autofocus: true, onClick: () => p().onResume() });
  const menu = h(
    'div.pause__menu',
    resume,
    button({ label: '다시 시작', icon: 'refresh', variant: 'ghost', size: 'lg', block: true, key: 'R', onClick: () => void confirm('restart') }),
    button({ label: '설정', icon: 'settings', variant: 'ghost', size: 'lg', block: true, onClick: () => p().onSettings() }),
    button({ label: '나가기', icon: 'exit', variant: 'danger', size: 'lg', block: true, key: 'Q', onClick: () => void confirm('quit') }),
  );

  const snap = ctx.ui.hud.snapshot;
  const trip = snap ? pauseTripCard(snap) : null;
  const head = h(
    'div.pause__head',
    h('span.pause__badge', icon('pause', 26)),
    h('div.pause__titles', h('h1.pause__title', 'PAUSED'), h('p.pause__sub', '잠깐 쉬어 가요 — 방콕은 기다려 줘요')),
    soiPlate({ th: 'พักก่อน', en: 'Take a break', class: 'pause__plate' }),
  );
  const sheet = h(
    'div.pause__sheet',
    { class: !trip && 'pause__sheet--solo', role: 'dialog', aria: { modal: true, label: '일시정지' } },
    scallop('tuk'),
    head,
    h('div.pause__body', trip, menu),
  );
  const legend = controlsLegend();
  ctx.el.append(h('div.pause', h('div.pause__stage', sheet, legend)));

  return {
    enter() {
      pop(sheet, { from: 0.92 });
      stagger(menu.children, { delay: 120, step: 50 });
      if (trip) slideIn(trip, 'left', { distance: 20, delay: 80 });
      slideIn(legend, 'bottom', { distance: 16, delay: 260 });
    },
    async leave() {
      await Promise.all([settled(popOut(sheet, { to: 0.95, duration: 180 })), settled(ctx.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }))]);
    },
    key(e) {
      if (asking || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false;
      const k = e.key.toLowerCase();
      if (k === 'p') p().onResume();
      else if (k === 'r') void confirm('restart');
      else if (k === 'q') void confirm('quit');
      else return false;
      return true;
    },
    back() {
      p().onResume();
      return true;
    },
  };
}
