/**
 * Traffic harness: a generated district (real city view) with the living traffic — signals, NPC cars, filtering
 * motorbikes, pedestrians — around a stationary rider marker, through the real Engine / Environment / PostFx.
 * URL: ?seed=7 &district=sukhumvit &intensity=light|rush|gridlock &tod=morning|noon|sunset|night &rain=0..1
 *      &cam=diorama|orbit|free &spot=kerb|road &back=<m before the stop line> &q=low|medium|high &cars=&motos=&peds= (budget overrides)
 *      &crowd=<× walker density>
 *      &warm=<s> (pre-roll) &hud=0 &yaw=<rad> &zoom=<×> (orbit / free) &watch=walker|vendor|monk (follow one)
 * Keys: 1-3 intensity · T time of day · R rain · C camera · Q quality. Drag = orbit, wheel = zoom, WASD/QE = free fly.
 * Exposes window.__ready, window.__stats (agents, fps, draw calls, overlaps, sim ms …), window.__traffic.
 */
import '@fontsource/kanit/500.css';
import '@fontsource/kanit/700.css';
import { Scene } from 'three';
import { INTENSITY } from '../core/config/traffic';
import { Rng } from '../core/rng';
import type { DistrictId, TimeOfDay, TrafficIntensity } from '../core/types';
import { Assets, Engine, Environment, GameLoop, isQualityPreset } from '../engine';
import { CameraProbe, motoBudget, TrafficSystem, TrafficView, trafficAssetNames } from '../traffic';
import { Marker, type MarkerMode, pickSpot } from '../traffic/dev/marker';
import { CAM_MODES, type CamMode, SandboxCamera } from '../traffic/dev/sandbox-camera';
import { createCityQuery, DISTRICT_IDS, generateCity } from '../world';
import { buildCityView, cityAssetNames, preloadCityFonts } from '../world/build';

interface TrafficWindow {
  __ready?: boolean;
  __stats?: Record<string, unknown>;
  __traffic?: TrafficSystem;
  /** junction + approach in front of the marker (e.g. wait for its red: __traffic.lamp(__spot.node, __spot.edge)) */
  __spot?: { node: number; edge: number };
  /** the marker as the simulation sees it (benchmarks: __traffic.update(1/60, __player, 'gridlock')) */
  __player?: Marker['player'];
}
const W = window as unknown as TrafficWindow;
const qs = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (qs.has(k) ? Number(qs.get(k)) : d);
const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
const INTENSITIES: readonly TrafficIntensity[] = ['light', 'rush', 'gridlock'];

const seed = num('seed', 7);
const district = (DISTRICT_IDS.find((d) => d === qs.get('district')) ?? 'sukhumvit') as DistrictId;
let intensity: TrafficIntensity = INTENSITIES.find((i) => i === qs.get('intensity')) ?? 'rush';
let tod: TimeOfDay = TODS.find((t) => t === qs.get('tod')) ?? 'sunset';
const weather = { rain: num('rain', 0), haze: 0, overcast: num('rain', 0) > 0 ? 0.8 : 0 };
const hud = document.getElementById('tr-hud') as HTMLDivElement;
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
const names = [...new Set([...cityAssetNames(data), ...trafficAssetNames()])];
await Promise.all([preloadCityFonts(), assets.preload(names, (d, t, n) => (hud.textContent = `loading ${d}/${t} · ${n}`))]);
const city = buildCityView(data, { quality: engine.quality, rng: new Rng(seed).fork('cityview'), assets });
scene.add(city.root);

const spotMode: MarkerMode = qs.get('spot') === 'road' ? 'road' : 'kerb';
const spot = pickSpot(query, spotMode, num('back', 20));
const marker = new Marker(spot);
marker.ring.position.y = city.groundHeight(spot.pos.x, spot.pos.z) + 0.03;
scene.add(marker.ring);
const carBudget = num('cars', engine.quality.maxNpcVehicles);
const traffic = new TrafficSystem(query, new Rng(seed), {
  intensity, audit: true, conditions: { timeOfDay: tod, rain: weather.rain },
  caps: {
    cars: carBudget, motos: num('motos', motoBudget(carBudget, intensity)), pedestrians: num('peds', engine.quality.maxPedestrians),
    crowd: num('crowd', 1),
  },
});
W.__traffic = traffic;
W.__spot = { node: spot.node, edge: spot.edge };
W.__player = marker.player;
const view = new TrafficView(assets, query, { bus: null });
scene.add(view.root);
const probe = new CameraProbe(query);
const cam = new SandboxCamera(engine.camera, canvas, spot.focus, spot.heading, (CAM_MODES.find((c) => c === qs.get('cam')) ?? 'diorama') as CamMode, num('yaw', -0.12), num('zoom', 1));
let simMs = 0;
let puffs = 0;
traffic.onExhaust = () => puffs++;
cam.update(0);
probe.update(engine.camera, engine.quality.drawDistance);
traffic.setViewProbe(probe);
traffic.warmup(marker.player, num('warm', 25), intensity);

const watchRole = qs.get('watch');
let watched: number | null = null;
/** the person of the watched role nearest to the marker (re-picked when it leaves) */
function watchTarget(): { x: number; z: number } | null {
  if (!watchRole) return null;
  const list = traffic.peds.active;
  let best = list.find((p) => p.id === watched);
  if (!best) {
    let d = Infinity;
    for (const p of list) {
      const dd = Math.hypot(p.pos.x - spot.pos.x, p.pos.z - spot.pos.z);
      if (p.role === watchRole && dd < d) [best, d] = [p, dd];
    }
    watched = best?.id ?? null;
  }
  return best ? best.pos : null;
}

let frames = 0;
new GameLoop({
  step: (dt) => {
    const t0 = performance.now();
    traffic.update(dt, marker.player, intensity);
    simMs += (performance.now() - t0 - simMs) * 0.05;
  },
  render: (_a, dt) => {
    const w = watchTarget();
    if (w) cam.follow(w, frames === 0 ? 1e3 : dt);
    const fx = cam.update(dt);
    probe.update(engine.camera, engine.quality.drawDistance);
    env.update(dt, cam.lookAt);
    traffic.setConditions({ timeOfDay: tod, rain: env.weather.rain });
    const t0 = performance.now();
    view.update(traffic, {
      camera: engine.camera, dt, night: env.night, lamps: env.lampsOn, rain: env.weather.rain,
      groundHeight: city.groundHeight,
    }, [marker.vehicle]);
    const viewMs = performance.now() - t0;
    city.update(dt, {
      night: env.night, lamps: env.lampsOn, wet: Math.min(1, env.weather.rain * 1.3), camPos: engine.camera.position,
      signal: (n) => traffic.signal(n),
    });
    engine.post.set({ ...env.grade(), ...fx });
    if (frames === 0) engine.post.snap();
    engine.render();
    if (++frames % 20 === 0) publish(viewMs);
    if (frames === 45) W.__ready = true;
  },
}).start();

function publish(viewMs: number): void {
  const s = engine.stats();
  const t = traffic.stats();
  const v = view.stats();
  W.__stats = {
    fps: Math.round(s.fps), frameMs: +s.frameMs.toFixed(2), gpuMs: +s.gpuMs.toFixed(2), cpuMs: +s.cpuMs.toFixed(2), drawCalls: s.drawCalls,
    triangles: s.triangles, preset: s.preset, intensity, tod, agents: t.cars + t.motos, cars: t.cars, motos: t.motos, peds: t.pedestrians,
    overlaps: t.overlaps, maxOverlap: +t.maxOverlap.toFixed(3), avgSpeed: +t.avgSpeed.toFixed(2), unstuck: t.unstuck,
    ring: Math.round(t.ringRadius), simMs: +simMs.toFixed(3), viewMs: +viewMs.toFixed(3), drawnVehicles: v.vehiclesDrawn,
    drawnPeople: v.peopleDrawn, characters: v.characters, exhaustPuffs: puffs,
  };
  hud.innerHTML = `<b>${district.toUpperCase()}</b> · ${INTENSITY[intensity].label} ${intensity} · ${tod} · ${cam.mode} · ${s.preset}\n` +
    `${s.fps.toFixed(0)} fps · ${s.drawCalls} draws · ${(s.triangles / 1000).toFixed(0)}k tris · gpu ${s.gpuMs.toFixed(1)} ms\n` +
    `${t.cars} cars · ${t.motos} motos · ${t.pedestrians} people · ring ${t.ringRadius.toFixed(0)} m · ⌀ ${(t.avgSpeed * 3.6).toFixed(0)} km/h\n` +
    `sim ${simMs.toFixed(2)} ms · view ${viewMs.toFixed(2)} ms · overlaps <i>${t.overlaps}</i> (max ${(t.maxOverlap * 100).toFixed(0)} cm)`;
}

addEventListener('keydown', (e) => {
  const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
  if (i >= 0) {
    intensity = INTENSITIES[i];
    traffic.setCaps({ motos: motoBudget(carBudget, intensity) });
  } else if (e.code === 'KeyT') env.setTimeOfDay((tod = TODS[(TODS.indexOf(tod) + 1) % TODS.length]), 2.5);
  else if (e.code === 'KeyR') env.setWeather({ rain: (weather.rain = weather.rain > 0 ? 0 : 1), overcast: weather.rain > 0 ? 0.8 : 0 }, 2);
  else if (e.code === 'KeyC') cam.mode = CAM_MODES[(CAM_MODES.indexOf(cam.mode) + 1) % CAM_MODES.length];
  else if (e.code === 'KeyQ' && cam.mode !== 'free') engine.setQuality(engine.quality.preset === 'medium' ? 'high' : engine.quality.preset === 'high' ? 'low' : 'medium');
});
