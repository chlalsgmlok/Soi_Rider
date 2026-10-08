/**
 * City view harness: a generated district rendered through the real Engine / Environment / PostFx at the mockup-03
 * diorama angle. URL: ?seed=7 &district=sukhumvit &tod=morning|noon|sunset|night &rain=0..1 &haze &overcast
 *   &view=spawn|soi|corner|junction|bts|facade|signal|top &fly=1 (scripted fly-through) &q=low|medium|high &hud=0 &wet=0..1 (override)
 *   debug: &ts=0 (no tilt-shift) &atlas=signs|marks (show an atlas) &fx=&fz=&fh=°&back=&up=&ly= (free camera)
 * Keys: 1-4 time of day · R rain · V next view · F fly · Q quality. Exposes window.__ready / __stats / __city.
 */
import '@fontsource/kanit/500.css';
import '@fontsource/kanit/700.css';
import '@fontsource/kanit/800.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import { type Mesh, type MeshStandardMaterial, Scene, Vector3 } from 'three';
import { headingOf } from '../core/math2d';
import { Rng } from '../core/rng';
import type { DistrictId, SignalPhase, SignalView, TimeOfDay, Vec2 } from '../core/types';
import { Assets, Engine, Environment, GameLoop, isQualityPreset } from '../engine';
import { createCityQuery, DISTRICT_IDS, generateCity } from '../world';
import { buildCityView, cityAssetNames, preloadCityFonts, type CityView } from '../world/build';

interface CityWindow { __ready?: boolean; __stats?: Record<string, unknown>; __city?: CityView }
const W = window as unknown as CityWindow;
const qs = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (qs.has(k) ? Number(qs.get(k)) : d);
const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const VIEWS = ['spawn', 'soi', 'corner', 'junction', 'bts', 'facade', 'signal', 'top'] as const;
type ViewName = (typeof VIEWS)[number];

const seed = num('seed', 7);
const district = (DISTRICT_IDS.find((d) => d === qs.get('district')) ?? 'sukhumvit') as DistrictId;
let tod: TimeOfDay = TODS.find((t) => t === qs.get('tod')) ?? 'sunset';
const weather = { rain: num('rain', 0), haze: num('haze', 0), overcast: num('overcast', num('rain', 0) > 0 ? 0.8 : 0) };
let view: ViewName = VIEWS.find((v) => v === qs.get('view')) ?? 'spawn';
let fly = qs.get('fly') === '1';
const hud = document.getElementById('city-hud') as HTMLDivElement;
if (qs.get('hud') === '0') hud.classList.add('hide');

const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const q = qs.get('q');
const engine = new Engine(canvas, { quality: isQualityPreset(q) ? q : 'medium' });
const scene = new Scene();
const env = new Environment(engine.renderer, engine.quality, tod);
env.attach(scene);
env.setWeather(weather, 0);
engine.onQualityChange((qq) => env.setQuality(qq));
engine.setScene(scene);

const data = generateCity(seed, district);
const query = createCityQuery(data);
const assets = new Assets();
await Promise.all([preloadCityFonts(), assets.preload(cityAssetNames(data), (d, t, n) => (hud.textContent = `loading ${d}/${t} · ${n}`))]);
const city = buildCityView(data, { quality: engine.quality, rng: new Rng(seed).fork('cityview'), assets });
scene.add(city.root);
W.__city = city;
if (qs.get('atlas')) {
  const mesh = city.root.getObjectByName(qs.get('atlas') === 'marks' ? 'city_markings' : 'city_signs') as Mesh | undefined;
  const img = (mesh?.material as MeshStandardMaterial | undefined)?.map?.image as HTMLCanvasElement | undefined;
  if (img) document.body.append(Object.assign(img, { style: 'position:fixed;inset:0;width:100vh;height:100vh;z-index:9;background:#888' }));
}

interface Shot { focus: Vec2; heading: number; back: number; up: number; yaw: number; fov: number; lookY?: number }
const laneHeading = (p: Vec2): number => {
  const hit = query.nearestLane(p, 30);
  return hit ? headingOf(hit.lane.dir) : 0;
};
function shotFor(v: ViewName): Shot {
  if (qs.has('fx')) return { focus: { x: num('fx', 0), z: num('fz', 0) }, heading: (num('fh', 0) * Math.PI) / 180, back: num('back', 6), up: num('up', 4), yaw: 0, fov: 40, lookY: num('ly', 0.6) };
  const diorama = { back: 12, up: 13.5, yaw: 0.12, fov: 36 };
  if (v === 'soi') {
    const cart = data.placements.find((p) => p.meta?.story) ?? data.placements.find((p) => p.asset === 'prop_food_cart');
    const at = cart ? { x: cart.pos.x, z: cart.pos.z } : data.spawn.pos;
    const hit = query.nearestLane(at, 30);
    const f = hit ? { x: hit.lane.start.x + hit.lane.dir.x * hit.s, z: hit.lane.start.z + hit.lane.dir.z * hit.s } : at;
    return { focus: f, heading: laneHeading(f), ...diorama, yaw: -0.18 };
  }
  if (v === 'junction') {
    const signals = data.nodes.filter((x) => x.signal);
    const n = signals.find((x) => x.edges.every((id) => !data.edges[id].skytrain)) ?? signals[0] ?? data.nodes[0];
    const e = data.edges[n.edges.find((id) => !data.edges[id].skytrain) ?? n.edges[0]];
    const h = headingOf(e.a === n.id ? { x: -e.dir.x, z: -e.dir.z } : e.dir);
    return { focus: { x: n.pos.x - Math.sin(h) * 14, z: n.pos.z - Math.cos(h) * 14 }, heading: h, back: 16, up: 17, yaw: -0.5, fov: 38 };
  }
  if (v === 'bts') {
    const st = data.placements.find((p) => p.asset === 'bts_station');
    const p = st ? { x: st.pos.x - Math.sin(st.heading) * 58, z: st.pos.z - Math.cos(st.heading) * 58 } : data.spawn.pos;
    return { focus: p, heading: st?.heading ?? 0, back: 30, up: 24, yaw: 0.7, fov: 38 };
  }
  if (v === 'facade') {
    const shop = data.placements.filter((p) => p.meta?.text && p.asset.startsWith('bld_shophouse'))
      .sort((a, b) => Math.hypot(a.pos.x - data.spawn.pos.x, a.pos.z - data.spawn.pos.z) - Math.hypot(b.pos.x - data.spawn.pos.x, b.pos.z - data.spawn.pos.z))[0];
    const p = shop ?? data.placements[0];
    return { focus: { x: p.pos.x + Math.sin(p.heading) * 2, z: p.pos.z + Math.cos(p.heading) * 2 }, heading: p.heading + Math.PI, back: num('back', 9), up: num('up', 5), yaw: 0, fov: 45, lookY: 3.6 };
  }
  if (v === 'corner') {
    const carts = data.placements.filter((p) => p.asset === 'prop_food_cart');
    const mouths = data.nodes.filter((n) => !n.signal && n.edges.length >= 3 && n.edges.some((id) => data.edges[id].cls === 'soi') && n.edges.some((id) => data.edges[id].cls !== 'soi'));
    const score = (n: (typeof mouths)[number]): number => carts.filter((c) => Math.hypot(c.pos.x - n.pos.x, c.pos.z - n.pos.z) < 22).length;
    const n = mouths.sort((a, b) => score(b) - score(a))[0] ?? data.nodes[0];
    const major = data.edges[n.edges.find((id) => data.edges[id].cls !== 'soi') ?? n.edges[0]];
    const soi = data.edges[n.edges.find((id) => data.edges[id].cls === 'soi') ?? n.edges[0]];
    const along = major.a === n.id ? major.dir : { x: -major.dir.x, z: -major.dir.z };
    const into = soi.a === n.id ? soi.dir : { x: -soi.dir.x, z: -soi.dir.z };
    const side = Math.sign(along.z * into.x - along.x * into.z) || 1;
    return { focus: { x: n.pos.x - along.x * 6, z: n.pos.z - along.z * 6 }, heading: headingOf(along), back: 13, up: 14, yaw: 0.45 * side, fov: 38 };
  }
  if (v === 'signal') {
    const t = data.placements.find((p) => p.asset === 'prop_traffic_light') ?? data.placements[0];
    const head = { x: t.pos.x + Math.cos(t.heading) * 3, z: t.pos.z - Math.sin(t.heading) * 3 };
    return { focus: head, heading: t.heading + Math.PI, back: 9, up: 5.2, yaw: 0, fov: 40, lookY: 5 };
  }
  if (v === 'top') return { focus: data.spawn.pos, heading: 0, back: 60, up: 140, yaw: 0, fov: 40 };
  return { focus: data.spawn.pos, heading: data.spawn.heading, ...diorama };
}

const camPos = new Vector3();
const camTarget = new Vector3();
const wantPos = new Vector3();
const wantTarget = new Vector3();
function aim(s: Shot, snap: boolean): void {
  const yaw = s.heading + s.yaw;
  wantPos.set(s.focus.x - Math.sin(yaw) * s.back, s.up, s.focus.z - Math.cos(yaw) * s.back);
  wantTarget.set(s.focus.x + Math.sin(s.heading) * 3, s.lookY ?? 0.6, s.focus.z + Math.cos(s.heading) * 3);
  engine.camera.fov = s.fov;
  engine.camera.updateProjectionMatrix();
  if (!snap) return;
  camPos.copy(wantPos);
  camTarget.copy(wantTarget);
}
aim(shotFor(view), true);

/** sandbox stand-in for src/traffic signals: 30 s cycle, staggered per node */
const PHASES: ReadonlyArray<[SignalPhase, number]> = [['ns_green', 12], ['ns_yellow', 3], ['all_red', 1], ['ew_green', 12], ['ew_yellow', 3], ['all_red', 1]];
function signal(node: number, t: number): SignalView {
  let k = (t + node * 7.3) % 32;
  for (const [phase, d] of PHASES) {
    if (k < d) return { node, phase, remaining: d - k };
    k -= d;
  }
  return { node, phase: 'all_red', remaining: 0 };
}

let time = 0;
let frames = 0;
let flyClock = 0;
const focus3 = new Vector3();
new GameLoop({
  step: () => undefined,
  render: (_a, dt) => {
    time += dt;
    if (fly && (flyClock += dt) > 6) {
      flyClock = 0;
      view = VIEWS[(VIEWS.indexOf(view) + 1) % (VIEWS.length - 1)];
      aim(shotFor(view), false);
    }
    const k = 1 - Math.exp(-dt * 1.6);
    camPos.lerp(wantPos, k);
    camTarget.lerp(wantTarget, k);
    engine.camera.position.copy(camPos);
    engine.camera.lookAt(camTarget);
    env.update(dt, focus3.set(camTarget.x, 0, camTarget.z));
    const wet = num('wet', Math.min(1, env.weather.rain * 1.3));
    city.update(dt, { night: env.night, lamps: env.lampsOn, wet, camPos, focus: { x: camTarget.x, z: camTarget.z }, signal: (n) => signal(n, time) });
    engine.post.set({ ...env.grade(), tiltShift: view === 'top' || qs.get('ts') === '0' ? 0 : 1, focusY: 0.42, focusBand: 0.16, focusFeather: 0.3 });
    if (frames === 0) engine.post.snap();
    engine.render();
    if (++frames % 30 === 0) publish();
    if (frames === 60) W.__ready = true;
  },
}).start();

function publish(): void {
  const s = engine.stats();
  const c = city.stats();
  W.__stats = { ...s, city: c, seed, district, tod, view };
  hud.innerHTML = `<b>${district.toUpperCase()}</b> · seed ${seed} · ${tod} · ${view}${fly ? ' (fly)' : ''} · ${s.preset}\n` +
    `${s.fps.toFixed(0)} fps · ${s.drawCalls} draws · ${(s.triangles / 1000).toFixed(0)}k tris · gpu ${s.gpuMs.toFixed(1)} ms\n` +
    `${c.instances} instances · ${c.groundChunks} chunks · ${c.signs} signs · ${c.wireSpans} spans · build ${c.buildMs} ms`;
}

addEventListener('keydown', (e) => {
  const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (i >= 0) env.setTimeOfDay((tod = TODS[i]), 2.5);
  else if (e.code === 'KeyR') env.setWeather({ rain: (weather.rain = weather.rain > 0 ? 0 : 1), overcast: weather.rain > 0 ? 0.8 : 0 }, 2);
  else if (e.code === 'KeyV') aim(shotFor((view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length])), false);
  else if (e.code === 'KeyF') fly = !fly;
  else if (e.code === 'KeyQ') engine.setQuality(engine.quality.preset === 'medium' ? 'high' : engine.quality.preset === 'high' ? 'low' : 'medium');
});
