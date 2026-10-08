/**
 * UI sandbox (sandbox/ui.html). Views: hud (default) · components · transition. See the html for params.
 * Sets window.__ready once fonts are loaded and the first frame is on screen; window.__stats has frame timing.
 */
import { bus } from '../core/events';
import type { GameEvents } from '../core/events';
import type { PauseProps } from '../core/types/screens';
import type { MissionPhase, TimeOfDay } from '../core/types/game';
import { UI } from '../ui/core/ui';
import { registerScreen } from '../ui/core/screen-registry';
import { h } from '../ui/core/h';
import { icon } from '../ui/icons/icon';
import { button } from '../ui/components/button';
import { soiPlate } from '../ui/components/street';
import { gallery } from '../ui/components/gallery';
import { DEMO_SCRIPT, demoMapSource, demoState, mockupAnchors } from '../ui/hud/demo-feed';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: Record<string, number | string>;
    __wipe?: () => void;
    __pause?: () => void;
    /** run n synthetic frames (t += 1/60) through hud.update + a forced style/layout flush; returns timings in ms */
    __bench?: (n: number) => string;
  }
}

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'hud';
const bgKey = q.get('bg') ?? '03';
const phase = (q.get('phase') ?? 'toDropoff') as MissionPhase;
const tod = (q.get('tod') ?? (bgKey === '02' ? 'night' : 'sunset')) as TimeOfDay;
const root = document.getElementById('ui') as HTMLElement;
const bg = document.getElementById('bg') as HTMLElement;
const ui = new UI(root);
if (q.get('reduced') === '1') ui.setReducedMotion(true);

const BG: Record<string, string> = { '03': '/docs/reference/mockup-03-diorama.png', '02': '/docs/reference/mockup-02-pov-rain.png' };
if (BG[bgKey] && view !== 'components') bg.style.backgroundImage = `url(${BG[bgKey]})`;
document.body.dataset.bg = view === 'components' ? 'none' : bgKey;
if (q.get('raw') === '1') document.body.dataset.raw = '';

const ready = async (): Promise<void> => {
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => (window.__ready = true)));
};

function emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
  bus.emit(type, payload);
}

function runHud(): void {
  ui.hud.configure({ topSpeedKmh: 70, timeOfDay: tod, minimap: q.get('minimap') !== '0' });
  ui.hud.setMapSource(demoMapSource());
  ui.hud.bind(bus);
  ui.show('hud', {}, 'none');
  const t0 = performance.now();
  let promptAt: number | null = null;
  let fired = new Set<number>();
  let cycle = -1;
  let frames = 0;
  let total = 0;
  let max = 0;
  let paused = q.get('freeze') !== null;
  const freezeAt = Number(q.get('freeze') ?? '0');
  window.__pause = () => (paused = !paused);
  window.__bench = (n) => {
    const anchors = mockupAnchors(bgKey, innerWidth, innerHeight);
    let js = 0;
    let flush = 0;
    for (let i = 0; i < n; i++) {
      const st = demoState(20 + i / 60, anchors, null, phase);
      const a = performance.now();
      ui.hud.update(st);
      const b = performance.now();
      void document.body.offsetHeight;
      js += b - a;
      flush += performance.now() - b;
    }
    return JSON.stringify({ frames: n, updateMs: +(js / n).toFixed(4), styleLayoutMs: +(flush / n).toFixed(4) });
  };
  const frame = (): void => {
    const t = paused ? freezeAt : (performance.now() - t0) / 1000;
    const c = Math.floor(t / 10);
    if (c !== cycle) {
      cycle = c;
      fired = new Set();
    }
    const local = t % 10;
    DEMO_SCRIPT.forEach((cue, i) => {
      if (local >= cue.at && !fired.has(i) && !paused) {
        fired.add(i);
        if (cue.type === 'story:prompt') promptAt = t;
        emit(cue.type, cue.payload as never);
      }
    });
    const s0 = performance.now();
    ui.hud.update(demoState(t, mockupAnchors(bgKey, innerWidth, innerHeight), promptAt, phase));
    const dt = performance.now() - s0;
    frames++;
    total += dt;
    max = Math.max(max, frames > 30 ? dt : 0);
    window.__stats = { frames, avgUpdateMs: +(total / frames).toFixed(3), maxUpdateMs: +max.toFixed(3) };
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function runComponents(): void {
  root.style.zIndex = '20';
  document.body.append(gallery(ui));
}

/** demo screens registered only in this sandbox — reference implementation for screen modules */
function runTransition(): void {
  registerScreen('boot', (ctx) => {
    const fill = h('div.loader-road__fill');
    const road = h('div.loader-road', { style: { '--v': 0 } }, fill, h('div.loader-road__rider', icon('bike', 34)));
    const label = h('div.t-caption.t-dim', { style: { marginTop: '12px' } }, '');
    ctx.el.append(
      h('div', { style: { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 50% 40%, #2a3146, #151821 70%)' } },
        h('div', { style: { width: 'min(460px, 80vw)', textAlign: 'center' } }, h('div.t-logo', { style: { fontSize: '64px', marginBottom: '14px' } }, 'SOI ', h('b', { style: { color: 'var(--c-cyan)' } }, 'RIDER')), soiPlate({ th: 'ซอย สุขุมวิท 23', en: 'Sukhumvit Soi 23' }), h('div', { style: { height: '34px' } }), road, label)),
    );
    return {
      update(p) {
        road.style.setProperty('--v', String(p.progress));
        label.textContent = p.label;
      },
    };
  });
  registerScreen('pause', (ctx) => {
    const p = ctx.props();
    const btn = (label: string, ic: Parameters<typeof icon>[0], fn: () => void, variant: 'primary' | 'ghost' | 'danger' = 'ghost'): HTMLButtonElement => button({ label, icon: ic, variant, block: true, size: 'lg', onClick: fn });
    ctx.el.append(
      h('div', { style: { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', background: 'var(--scrim)', backdropFilter: 'blur(6px)' } },
        h('div.panel', { style: { width: '360px', padding: '22px', gap: '12px' } }, soiPlate({ en: 'Paused', th: 'หยุดชั่วคราว' }), h('div', { style: { height: '6px' } }), btn('계속 달리기', 'play', p.onResume, 'primary'), btn('다시 시작', 'refresh', p.onRestart), btn('설정', 'settings', p.onSettings), btn('그만두기', 'exit', p.onQuit, 'danger'))),
    );
    return { back: () => (p.onResume(), true) };
  });

  ui.hud.configure({ topSpeedKmh: 70, timeOfDay: 'sunset', minimap: true });
  ui.hud.setMapSource(demoMapSource());
  const anchors = mockupAnchors(bgKey, innerWidth, innerHeight);
  const tick = (): void => {
    ui.hud.update(demoState(performance.now() / 1000, anchors, null));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const pauseProps: PauseProps = {
    onResume: () => void pause?.close(),
    onRestart: () => ui.toast('다시 시작', 'info', 'refresh'),
    onSettings: () => ui.toast('설정 화면은 screens 에이전트 담당', 'info', 'settings'),
    onQuit: () => window.__wipe?.(),
  };
  let pause: ReturnType<typeof ui.show<'pause'>> | null = null;
  window.__pause = () => (pause = ui.show('pause', pauseProps, 'none'));
  window.__wipe = () => {
    const boot = ui.show('boot', { progress: 0, label: '방콕 지도를 불러오는 중…' }, 'fade');
    let v = 0;
    const id = window.setInterval(() => {
      v = Math.min(1, v + 0.12);
      boot.update({ progress: v, label: v < 1 ? `에셋 로딩 ${Math.round(v * 100)}%` : '출발 준비 완료!' });
      if (v >= 1) {
        window.clearInterval(id);
        ui.show('hud', {}, 'wipe');
      }
    }, 140);
  };
  window.__wipe();
}

if (view === 'components') runComponents();
else if (view === 'transition') runTransition();
else runHud();
void ready();
