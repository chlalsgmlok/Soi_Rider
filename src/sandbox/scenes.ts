/**
 * Backdrop scenes harness (src/app/scenes): the title diorama, the garage turntable and the intro win stand through
 * the real Engine / Environment / PostFx / Assets, driven like the app will (enter → update every frame → render).
 * URL: ?scene=title|garage|intro &q=low|medium|high &hud=0 &guide=1 (shade where the right-docked UI sits)
 *   title:  &tod= &intensity= &warm=<s> &reduced=1        keys T time of day · M reduced motion
 *   garage: &bike= &outfit= &helmet= &gear= &yaw=<rad>     keys ← → rotate · E equip next look · B next bike
 *   intro:  &seed= &district= &tod= &traffic=0 &swoop=<ms> keys Enter swoop to ride
 * Exposes window.__ready, window.__stats and window.__harness (debug handle).
 */
import '@fontsource/kanit/500.css';
import '@fontsource/kanit/700.css';
import '@fontsource/kanit/800.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { garageHarness } from '../app/scenes/dev/garage-harness';
import type { Harness } from '../app/scenes/dev/harness';
import { introHarness } from '../app/scenes/dev/intro-harness';
import { titleHarness } from '../app/scenes/dev/title-harness';
import { Assets, Engine, GameLoop, isQualityPreset } from '../engine';
import { createDefaultSave } from '../logic';

interface ScenesWindow {
  __ready?: boolean;
  __stats?: Record<string, unknown>;
  __harness?: Harness;
}
const W = window as unknown as ScenesWindow;
const qs = new URLSearchParams(location.search);
const hud = document.getElementById('sc-hud') as HTMLDivElement;
if (qs.get('hud') === '0') hud.classList.add('hide');
const guide = document.getElementById('sc-guide') as HTMLDivElement;

const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const q = qs.get('q');
const engine = new Engine(canvas, { quality: isQualityPreset(q) ? q : 'medium' });
const assets = new Assets();
const loadout = { ...createDefaultSave().loadout };
const progress = (text: string): void => {
  hud.textContent = text;
};

const which = qs.get('scene') ?? 'title';
const h = which === 'garage' ? await garageHarness(engine, assets, qs, loadout, progress)
  : which === 'intro' ? await introHarness(engine, assets, qs, loadout, progress)
    : await titleHarness(engine, assets, qs, loadout, progress);
W.__harness = h;
if (qs.get('guide') === '1' && which !== 'title') {
  guide.classList.add('show');
  guide.style.width = which === 'garage' ? 'calc(460px + 40px)' : 'calc(360px + 9vw + 28px)';
}
h.scene.enter(engine);

let frames = 0;
new GameLoop({
  step: () => undefined,
  render: (_a, dt) => {
    h.scene.update(dt);
    engine.render();
    if (++frames % 20 === 0) publish();
    if (frames === 40) W.__ready = true;
  },
}).start();

function publish(): void {
  const s = engine.stats();
  W.__stats = { fps: Math.round(s.fps), drawCalls: s.drawCalls, triangles: s.triangles, gpuMs: +s.gpuMs.toFixed(2), preset: s.preset, ...h.stats() };
  hud.innerHTML = `<b>${which.toUpperCase()}</b> · ${h.info()}\n` +
    `${s.fps.toFixed(0)} fps · ${s.drawCalls} draws · ${(s.triangles / 1000).toFixed(0)}k tris · gpu ${s.gpuMs.toFixed(1)} ms · ${s.preset}`;
}

addEventListener('keydown', (e) => {
  if (h.key(e.code)) publish();
});
