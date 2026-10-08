/**
 * Engine look-dev harness: a Bangkok street corner rendered through the real Engine / Environment / PostFx / Assets.
 * URL: ?tod=morning|noon|sunset|night &rain=0..1 &haze=0..1 &overcast=0..1 &q=low|medium|high|auto
 *      &view=diorama|squeeze|pov|top &tone=neutral|aces|agx &wet=0..1 &yaw=<deg> &blend=<sec> &hud=0
 *      &touch=on (force the touch overlay) &bench=1 (GPU A/B benchmark → window.__bench) &toon=0..1 &rim=0..1
 * Keys: 1-4 time of day · R rain · H haze · O overcast · Q quality · T tone map · V view · L wet lens · K toon · drag = orbit
 *       WASD / arrows / gamepad / touch drive the Input readout (the player bike leans + steers with it)
 * Exposes window.__ready, window.__stats { fps, gpuMs, drawCalls, triangles, … } and window.__input (PlayerInput).
 */
import { Scene } from 'three';
import type { PlayerInput, TimeOfDay } from '../core/types';
import { findNode } from '../engine/assets/material-tools';
import { Assets } from '../engine/assets/assets';
import { Engine } from '../engine/engine';
import { Environment } from '../engine/env/environment';
import { TOON } from '../engine/env/toonify';
import { Input } from '../engine/input/input';
import { GameLoop } from '../engine/loop';
import { type BenchResult, LookdevBench } from '../engine/lookdev/lookdev-bench';
import { frameLookdev, LOOKDEV_VIEWS, type LookdevView } from '../engine/lookdev/lookdev-camera';
import { buildLookdevScene, lookdevAssetNames } from '../engine/lookdev/lookdev-scene';
import type { PostFxParams, ToneMap } from '../engine/post/post-params';
import { isQualityPreset } from '../engine/quality';

interface LookdevWindow {
  __ready?: boolean;
  __stats?: Record<string, number | string>;
  __bench?: BenchResult[];
  /** debugging handle for eval-driven inspection */
  __scene?: Scene;
  __input?: PlayerInput;
}
const W = window as unknown as LookdevWindow;
const qs = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (qs.has(k) ? Number(qs.get(k)) : d);
const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const TONES: readonly ToneMap[] = ['neutral', 'aces', 'agx'];
/** K cycles [band, rim]: shipped look · plain PBR · strong cel */
const TOON_LOOKS: ReadonlyArray<readonly [number, number]> = [[0.55, 0.16], [0, 0], [1, 0.3]];

let tod: TimeOfDay = TODS.find((t) => t === qs.get('tod')) ?? 'sunset';
let view: LookdevView = LOOKDEV_VIEWS.find((v) => v === qs.get('view')) ?? 'diorama';
const weather = { overcast: num('overcast', 0), rain: num('rain', 0), haze: num('haze', 0) };
let wet = num('wet', -1);
let yawOffset = (num('yaw', -24) * Math.PI) / 180;
const qParam = qs.get('q');
const blendSec = num('blend', 2.5);
/** ?bench=1 runs the interleaved GPU A/B benchmark (window.__bench) */
const benchMode = qs.get('bench') === '1';
if (qs.has('toon')) TOON.band.value = num('toon', 0.55);
if (qs.has('rim')) TOON.rim.value = num('rim', 0.16);
const overrides: Partial<PostFxParams> = {};

const hud = document.getElementById('ld-hud') as HTMLDivElement;
if (qs.get('hud') === '0') hud.classList.add('hide');
const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const engine = new Engine(canvas, { quality: qParam === 'auto' ? 'auto' : isQualityPreset(qParam) ? qParam : 'medium' });
const toneParam = TONES.find((t) => t === qs.get('tone'));
if (toneParam) engine.post.toneMap = toneParam;
const scene = new Scene();
const env = new Environment(engine.renderer, engine.quality, tod);
env.attach(scene);
env.setWeather(weather, 0);
engine.onQualityChange((q) => env.setQuality(q));
engine.setScene(scene);

const assets = new Assets();
await assets.preload(lookdevAssetNames(), (done, total, name) => {
  hud.textContent = `loading ${done}/${total} · ${name}`;
});
const ld = buildLookdevScene(assets);
scene.add(ld.root);
W.__scene = scene;
const bench = benchMode ? new LookdevBench(engine.gpu, [
  { name: 'scene off (sky+post only)', set: (on) => (ld.root.visible = !on) },
  { name: 'shadows off', set: (on) => (engine.renderer.shadowMap.enabled = !on) },
  { name: 'IBL off', set: (on) => env.setQuality(on ? { ...engine.quality, envMapSize: 0 } : engine.quality) },
  { name: 'tilt-shift off', set: (on) => (on ? (overrides.tiltShift = 0) : delete overrides.tiltShift) },
]) : null;
engine.beginAutoQuality();
const input = new Input({ touch: qs.get('touch') === 'on' ? 'on' : 'auto' });
const steerNode = findNode(ld.player, 'steer');
const bikeRoot = ld.player.children[0];
let pi: PlayerInput = input.poll();

let frames = 0;
let statsTimer = 0;
const loop = new GameLoop({
  step: () => undefined,
  render: (_alpha, dt) => {
    pi = input.poll();
    W.__input = pi;
    if (pi.cameraPressed) view = cycle(LOOKDEV_VIEWS, view);
    if (steerNode) steerNode.rotation.y = -pi.steer * 0.45;
    bikeRoot.rotation.z += (pi.steer * 0.32 - bikeRoot.rotation.z) * Math.min(1, dt * 8);
    env.update(dt, ld.focus);
    ld.setLamps(env.lampsOn, env.night);
    ld.setWet(env.weather.rain);
    const cam = frameLookdev(engine.camera, view, ld.focus, ld.player.rotation.y, yawOffset, ld.player);
    const autoWet = view === 'pov' ? env.weather.rain : 0;
    engine.post.set({ ...env.grade(), ...cam, wet: wet >= 0 ? wet : autoWet, ...overrides });
    if (frames === 0 || bench) engine.post.snap();
    engine.render();
    if (bench && frames > 60 && !bench.done) {
      bench.update(dt);
      if (bench.done) W.__bench = bench.results;
    }
    frames++;
    statsTimer += dt;
    if (statsTimer > 0.5) {
      statsTimer = 0;
      publishStats();
    }
    if (frames === 40) W.__ready = true;
  },
});
loop.start();

function publishStats(): void {
  const s = engine.stats();
  W.__stats = { ...s, tod, view, tone: engine.post.toneMap, rain: weather.rain, haze: weather.haze,
    overcast: weather.overcast, placeholders: assets.placeholders().length };
  hud.innerHTML = `<b>${tod.toUpperCase()}</b> · ${view} · ${s.preset} · ${engine.post.toneMap}\n` +
    `rain ${weather.rain.toFixed(1)} · haze ${weather.haze.toFixed(1)} · overcast ${weather.overcast.toFixed(1)}\n` +
    `${s.fps.toFixed(0)} fps · ${s.drawCalls} draws · ${(s.triangles / 1000).toFixed(0)}k tris · ${s.programs} prog\n` +
    `placeholders ${assets.placeholders().length}/${lookdevAssetNames().length} · gpu ${s.gpuMs.toFixed(1)} ms
` +
    `input ${pi.device} · thr ${pi.throttle.toFixed(2)} · brk ${pi.brake.toFixed(2)} · steer ${pi.steer.toFixed(2)}`;
}

const cycle = <T>(list: readonly T[], v: T): T => list[(list.indexOf(v) + 1) % list.length];
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (i >= 0) {
    tod = TODS[i];
    env.setTimeOfDay(tod, blendSec);
  } else if (e.code === 'KeyR') weather.rain = weather.rain > 0 ? 0 : 1;
  else if (e.code === 'KeyH') weather.haze = weather.haze > 0 ? 0 : 0.8;
  else if (e.code === 'KeyO') weather.overcast = weather.overcast > 0 ? 0 : 1;
  else if (e.code === 'KeyQ') engine.setQuality(cycle(['low', 'medium', 'high'] as const, engine.quality.preset));
  else if (e.code === 'KeyT') engine.post.toneMap = cycle(TONES, engine.post.toneMap);
  else if (e.code === 'KeyV') view = cycle(LOOKDEV_VIEWS, view);
  else if (e.code === 'KeyL') wet = wet >= 0 ? -1 : 1;
  else if (e.code === 'KeyK') [TOON.band.value, TOON.rim.value] = cycle(TOON_LOOKS, TOON_LOOKS.find((t) => t[0] === TOON.band.value) ?? TOON_LOOKS[0]);
  else return;
  env.setWeather(weather, 2);
  publishStats();
});

let dragX = -1;
canvas.addEventListener('pointerdown', (e) => (dragX = e.clientX));
addEventListener('pointerup', () => (dragX = -1));
addEventListener('pointermove', (e) => {
  if (dragX < 0) return;
  yawOffset += (e.clientX - dragX) * 0.005;
  dragX = e.clientX;
});
