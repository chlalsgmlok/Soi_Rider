/**
 * Play-flow screens sandbox (sandbox/ui-play.html): boot · intro · pause · results · results-fail · settings with mock
 * props over the mockup-03 backdrop. window.__ready once fonts are loaded and the screen is revealed.
 */
import type { FailReason, Grade, TimeOfDay } from '../core/types/game';
import type { PauseProps, SettingsProps } from '../core/types/screens';
import type { Settings } from '../core/types/save';
import { DEFAULT_SETTINGS } from '../logic/save-defaults';
import { UI } from '../ui/core/ui';
import { demoMapSource, demoState, mockupAnchors } from '../ui/hud/demo-feed';
import { demoIntroProps } from '../ui/screens/intro/intro-demo';
import { demoResultsProps } from '../ui/screens/results/results-demo';
import '../ui/screens/boot';
import '../ui/screens/intro';
import '../ui/screens/pause';
import '../ui/screens/settings';
import '../ui/screens/results';

declare global {
  interface Window {
    __ready?: boolean;
    __log?: string[];
  }
}

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'boot';
const bgKey = q.get('bg') ?? (view === 'boot' ? 'none' : '03');
const BG: Record<string, string> = { '03': '/docs/reference/mockup-03-diorama.png', '02': '/docs/reference/mockup-02-pov-rain.png' };
const bg = document.getElementById('bg') as HTMLElement;
if (BG[bgKey]) bg.style.backgroundImage = `url(${BG[bgKey]})`;
document.body.dataset.bg = bgKey;
if (q.get('shot') === '1') document.body.dataset.shot = '';

const ui = new UI(document.getElementById('ui') as HTMLElement);
if (q.get('reduced') === '1') ui.setReducedMotion(true);
const log = (s: string): void => {
  (window.__log ??= []).push(s);
};

function runBoot(): void {
  const frozen = q.get('p');
  const boot = ui.show('boot', { progress: frozen ? Number(frozen) : 0, label: '방콕 지도를 펼치는 중…' }, 'none');
  if (frozen) return;
  const labels = ['방콕 지도를 펼치는 중…', '택시와 툭툭을 도로에 올리는 중…', '노점 불을 켜는 중…', '손님들이 콜을 부르는 중…', '출발 준비 완료!'];
  // fake load 0 → 1, hold on 출발 준비 완료! for ~2 s, then a second loading phase restarts the road
  let v = 0;
  let hold = 0;
  window.setInterval(() => {
    if (v >= 1 && ++hold < 8) return;
    hold = 0;
    v = v >= 1 ? 0 : Math.min(1, v + 0.035 + Math.random() * 0.06);
    boot.update({ progress: v, label: labels[Math.min(labels.length - 1, Math.floor(v * (labels.length - 1) + 0.001))] });
  }, 260);
}

/** after a call is accepted the app reveals the HUD: mirror that so the phone → mini-phone hand-off can be judged */
function revealHud(freeze = false): void {
  ui.hud.configure({ topSpeedKmh: 70, timeOfDay: 'sunset', minimap: true });
  ui.hud.setMapSource(demoMapSource());
  const anchors = mockupAnchors('03', innerWidth, innerHeight);
  const t0 = performance.now();
  let frames = 0;
  const tick = (): void => {
    ui.hud.update(demoState(freeze ? 4.2 : 2 + (performance.now() - t0) / 1000, anchors, null, freeze ? 'toDropoff' : 'toPickup'));
    if (!freeze || ++frames < 20) requestAnimationFrame(tick);
  };
  tick();
  ui.show('hud', {}, 'none');
}

function runIntro(): void {
  const props = demoIntroProps({
    secs: Number(q.get('secs') ?? 20),
    tod: (q.get('tod') ?? 'sunset') as TimeOfDay,
    rain: q.get('rain') === '1',
    trip: Number(q.get('trip') ?? 3),
    onAccept: (id) => {
      log(`onAccept:${id}`);
      revealHud();
    },
  });
  ui.show('intro', props, 'none');
}

let settings: Settings = { ...DEFAULT_SETTINGS };

function openSettings(): void {
  const props: SettingsProps = {
    settings,
    onChange: (s) => {
      settings = s;
      ui.setReducedMotion(s.reducedMotion ? true : null);
      log(`settings:${JSON.stringify(s)}`);
    },
    onBack: () => {
      log('settings:back');
      void handle.close();
    },
  };
  const handle = ui.show('settings', props, 'none');
}

function runPause(): void {
  if (q.get('hud') !== '0') revealHud(true);
  const props: PauseProps = {
    onResume: () => {
      log('pause:resume');
      void pause.close().then(() => window.setTimeout(runPauseAgain, 900));
    },
    onRestart: () => {
      log('pause:restart');
      ui.toast('같은 콜로 다시 출발!', 'info', 'refresh');
    },
    onSettings: () => {
      log('pause:settings');
      openSettings();
    },
    onQuit: () => {
      log('pause:quit');
      ui.toast('운행 포기 — 타이틀로', 'bad', 'exit');
    },
  };
  let pause = ui.show('pause', props, 'none');
  const runPauseAgain = (): void => {
    pause = ui.show('pause', props, 'none');
  };
}

function runSettings(): void {
  if (q.get('from') === 'pause') runPause();
  openSettings();
}

function runResults(failDefault: FailReason | null): void {
  const props = demoResultsProps({
    grade: (q.get('grade') ?? 'A') as Exclude<Grade, 'F'>,
    fail: (q.get('fail') as FailReason | null) ?? failDefault,
    best: q.get('best') !== '0',
    on: {
      next: () => (log('results:next'), ui.toast('다음 콜 준비!', 'good', 'phone')),
      garage: () => (log('results:garage'), ui.toast('차고로 이동', 'info', 'helmet')),
      title: () => (log('results:title'), ui.toast('타이틀로', 'info', 'home')),
    },
  });
  log(`grade:${props.result.grade} total:${props.result.total} baht:${props.result.totalBaht} best:${props.result.newBest}`);
  ui.show('results', props, 'none');
}

const views: Record<string, () => void> = {
  boot: runBoot,
  intro: runIntro,
  pause: runPause,
  settings: runSettings,
  results: () => runResults(null),
  'results-fail': () => runResults('comfort'),
};
(views[view] ?? runBoot)();
log(`view:${view}`);

void document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => (window.__ready = true))));
