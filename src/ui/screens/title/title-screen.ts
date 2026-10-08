/**
 * Title (TitleProps): transparent centre over the live 3D diorama, logo lockup top-left, chunky toy menu bottom-left
 * (시작 / 차고 / 상점 / 설정), ฿ + ⛽ wallets top-right, version/credits bottom-right.
 * First visit per session shows a pulsing "아무 키나 누르세요" gate: any key, click, tap or gamepad OK opens the menu.
 */
import './title.css';
import pkg from '../../../../package.json';
import type { SaveData } from '../../../core/types/save';
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { button } from '../../components/button';
import { chip, keycap, setChipText } from '../../components/chip';
import { curbDivider } from '../../components/street';
import { pop, popOut, settled, slideIn, stagger } from '../../core/animate';
import { fmtInt } from '../../core/count-up';
import { menuWallets } from '../shop/menu-wallets';
import { titleLogo } from './title-logo';

/** the press-any-key gate shows once per session */
let gateDone = false;

/** force the gate on (true) or skip it (false) for the next title mount — sandbox / app restarts */
export function setTitleGate(show: boolean): void {
  gateDone = !show;
}

const IGNORED = new Set(['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'F5', 'F11', 'F12', 'Escape', 'Backspace']);
const pad2 = (n: number): string => String(n).padStart(2, '0');

function startSub(save: SaveData): string {
  return save.fuel > 0 ? `TRIP ${pad2(save.tripsCompleted + 1)} · 연료 1 사용` : '연료가 비었어요 · 충전하고 출발';
}

function recordText(save: SaveData): string {
  return save.bestScore > 0 ? `최고 기록 ${fmtInt(save.bestScore)}` : '첫 콜을 기다리는 중';
}

export function mountTitle(ctx: ScreenContext<'title'>): ScreenView<'title'> {
  const p = ctx.props();
  const wallets = menuWallets(p.save);
  const start = button({
    label: '시작',
    sub: startSub(p.save),
    icon: 'play',
    size: 'xl',
    block: true,
    key: 'Enter',
    autofocus: true,
    class: 'title__start',
    onClick: () => ctx.props().onStart(),
  });
  const garage = button({ label: '차고', icon: 'helmet', variant: 'secondary', size: 'lg', block: true, onClick: () => ctx.props().onGarage() });
  const shop = button({ label: '상점', icon: 'cart', variant: 'secondary', size: 'lg', block: true, onClick: () => ctx.props().onShop() });
  const settings = button({ label: '설정', icon: 'settings', variant: 'ghost', size: 'md', block: true, onClick: () => ctx.props().onSettings() });
  const items = [start, h('div.title__menu-row', garage, shop), settings];
  const menu = h('nav.title__menu', { aria: { label: '메인 메뉴' } }, curbDivider('vertical'), h('div.title__menu-col', items));
  const record = chip({ text: recordText(p.save), icon: 'trophy', tone: p.save.bestScore > 0 ? 'warn' : 'neutral', class: 'title__record' });
  const top = h('div.title__top', wallets.el, record);
  const prompt = h(
    'button.title__prompt',
    { type: 'button', data: { autofocus: '', sfx: 'none' }, aria: { label: '아무 키나 눌러 시작' } },
    keycap('ANY', 'md'),
    h('span.title__prompt-text', h('span.title__prompt-ko', '아무 키나 누르세요'), h('span.title__prompt-en', 'PRESS ANY KEY · กดปุ่มใดก็ได้')),
  );
  const foot = h(
    'footer.title__foot',
    h('span.title__version.t-num', `SOI RIDER v${pkg.version}`),
    h('span', '소이 23 윈 스탠드에서 만든 방콕 라이딩'),
    h('span', '© 2026 · Kanit · Pretendard · three.js'),
  );
  let gated = !gateDone;
  const root = h('div.title', { data: { state: gated ? 'gate' : 'menu' } }, h('div.title__scrim'), h('div.title__brand', titleLogo()), menu, top, prompt, foot);
  menu.hidden = gated;
  top.hidden = gated;
  prompt.hidden = !gated;
  ctx.el.append(h('div.menu-stage', root));

  const revealMenu = (): void => {
    stagger(items, { step: 60, delay: 80, distance: 16 });
    slideIn(top, 'top', { distance: 18, delay: 40 });
  };

  const openGate = (): void => {
    if (!gated) return;
    gated = false;
    gateDone = true;
    ctx.ui.sfx('swoosh');
    root.dataset.state = 'menu';
    menu.hidden = false;
    top.hidden = false;
    start.focus({ preventScroll: true });
    revealMenu();
    void settled(popOut(prompt, { to: 0.92 })).then(() => (prompt.hidden = true));
  };

  prompt.addEventListener('click', openGate);
  const onPointer = (): void => openGate();
  ctx.el.addEventListener('pointerdown', onPointer);
  ctx.onDispose(() => ctx.el.removeEventListener('pointerdown', onPointer));

  return {
    enter() {
      if (gated) pop(prompt, { from: 0.8 });
      else revealMenu();
    },
    update(next, changed) {
      if (!changed.save) return;
      wallets.set(next.save);
      const sub = start.querySelector('.btn__sub');
      if (sub) sub.textContent = startSub(next.save);
      setChipText(record, recordText(next.save));
      record.classList.toggle('chip--warn', next.save.bestScore > 0);
    },
    key(e) {
      if (!gated || e.ctrlKey || e.metaKey || e.altKey || IGNORED.has(e.key)) return false;
      openGate();
      return true;
    },
    back: () => false,
  };
}
