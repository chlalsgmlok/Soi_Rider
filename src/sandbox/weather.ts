/**
 * Weather harness: a generated district (real city view + real traffic), a rider cruising the curb lane and the
 * WeatherSystem on top — timeline → Environment, rain / ripples / spray / puddle splashes / lens, smog & exhaust,
 * wet-road light reflections, wet paint, lightning.
 * URL: ?seed=7 &district= &tod=morning|noon|sunset|night &weather=clear|haze|rain|storm &t=<s of weather pre-roll>
 *      &cam=diorama|pov &q=low|medium|high &intensity=light|rush|gridlock &fx=0 (FX hidden: perf A/B) &ride=0 &hud=0 &warm=<s>
 * Keys: R downpour · H smog spike · L lightning · C camera (diorama → pov → side) · T time of day · G ride/stop
 *       F FX on/off · Q quality
 * Exposes window.__ready, window.__stats, window.__weather, window.__toPuddle() (ride through the nearest puddle),
 * window.__bench() (interleaved FX on/off GPU timing → { onMs, offMs, deltaMs }).
 */
import '@fontsource/kanit/500.css';
import '@fontsource/kanit/700.css';
import { Scene, Vector3 } from 'three';
import { CameraRig } from '../camera';
import { EventBus } from '../core/events';
import { KMH } from '../core/math2d';
import { Rng } from '../core/rng';
import type { TimeOfDay } from '../core/types';
import { Assets, Engine, Environment, GameLoop } from '../engine';
import { createDefaultSave } from '../logic';
import { PovCockpit, RiderRig, riderRigAssetNames } from '../player';
import { CameraProbe, motoBudget, TrafficSystem, TrafficView, trafficAssetNames } from '../traffic';
import { pickSpot } from '../traffic/dev/marker';
import { WeatherSystem } from '../weather';
import { FxBench, type FxBenchResult } from '../weather/dev/fx-bench';
import { LaneCruiser } from '../weather/dev/lane-cruiser';
import { findPuddleRun } from '../weather/dev/puddle-run';
import { SANDBOX_CAMS, type SandboxCam, sandboxParams, sandboxPlan } from '../weather/dev/sandbox-params';
import { type SandboxCounts, sandboxHud, sandboxStats } from '../weather/dev/sandbox-report';
import { createCityQuery, generateCity } from '../world';
import { buildCityView, cityAssetNames, preloadCityFonts } from '../world/build';

interface WeatherWindow {
  __ready?: boolean;
  __stats?: Record<string, number | string | boolean>;
  __weather?: WeatherSystem;
  __toPuddle?: () => boolean;
  /** splash events so far (bumped the moment the bus fires — headless captures wait on it) */
  __splashes?: number;
  /** metres from the rider to the latest exhaust puff and when it happened (performance.now ms) */
  __exhaust?: { d: number; at: number };
  /** interleaved FX on/off GPU A/B (resolves when finished) */
  __bench?: () => Promise<FxBenchResult>;
}
const W = window as unknown as WeatherWindow;
const P = sandboxParams(location.search);
const TODS: readonly TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];
let tod = P.tod;

const hud = document.getElementById('wx-hud') as HTMLDivElement;
if (!P.hud) hud.classList.add('hide');
const canvas = document.body.insertBefore(document.createElement('canvas'), document.body.firstChild);
const engine = new Engine(canvas, { quality: P.quality });
const scene = new Scene();
const env = new Environment(engine.renderer, engine.quality, tod);
env.attach(scene);
engine.setScene(scene);

const data = generateCity(P.seed, P.district);
const query = createCityQuery(data);
const assets = new Assets();
const names = [...new Set([...cityAssetNames(data), ...trafficAssetNames(), ...riderRigAssetNames()])];
await Promise.all([preloadCityFonts(), assets.preload(names, (d, t, n) => (hud.textContent = `loading ${d}/${t} · ${n}`))]);
const city = buildCityView(data, { quality: engine.quality, rng: new Rng(P.seed).fork('cityview'), assets });
scene.add(city.root);

const bus = new EventBus();
const cars = engine.quality.maxNpcVehicles;
const traffic = new TrafficSystem(query, new Rng(P.seed), {
  intensity: P.intensity, conditions: { timeOfDay: tod, rain: 0 }, bus,
  caps: { cars, motos: motoBudget(cars, P.intensity), pedestrians: engine.quality.maxPedestrians },
});
const view = new TrafficView(assets, query, { bus });
scene.add(view.root);
const spot = pickSpot(query, 'road', 34);
const start = query.nearestLane(spot.pos, 4);
if (!start) throw new Error('weather sandbox: no lane at the start spot');
const cruiser = new LaneCruiser(query, traffic, new Rng(P.seed).fork('cruiser'), start.lane, start.s);
cruiser.riding = P.ride;
const rig = new RiderRig(assets, createDefaultSave().loadout, engine.quality);
scene.add(rig.root);
const cockpit = new PovCockpit(rig, engine.quality);
cockpit.attach(engine.camera);
const cam = new CameraRig(engine.camera);
cam.setWorld(query);
let shotCam: SandboxCam = P.cam;
cam.setMode(shotCam === 'pov' ? 'pov' : 'diorama');
const sideTarget = new Vector3();
/** the 'side' close-up: a low chase just right of the rider's track, light tilt-shift */
const sideCam = (): ReturnType<CameraRig['orbit']> => {
  const st = cruiser.state;
  sideTarget.set(st.pos.x, city.groundHeight(st.pos.x, st.pos.z), st.pos.z);
  return cam.orbit(sideTarget, 0, { radius: 5.5, height: 2.6, start: st.heading + 0.35, speed: 0, fov: 44, tilt: 0.35, lookUp: 0.5 });
};

const weather = new WeatherSystem(sandboxPlan(P.weather), {
  env, scene, camera: engine.camera, quality: engine.quality, rng: new Rng(P.seed).fork('weather'), bus, city, traffic,
  trafficView: view, rider: cruiser.state, glossy: [rig.root],
});
weather.fxEnabled = P.fx;
const counts: SandboxCounts = { splash: 0, soaked: 0, thunder: 0, exhaust: 0, change: '' };
traffic.onExhaust = (e) => {
  counts.exhaust++;
  W.__exhaust = { d: Math.hypot(e.pos.x - cruiser.state.pos.x, e.pos.z - cruiser.state.pos.z), at: performance.now() };
  weather.emitExhaust(e.pos, e.heading, e.strength);
};
engine.onQualityChange((q) => [env, rig, cockpit, weather].forEach((o) => o.setQuality(q)));
bus.on('splash', (p) => {
  W.__splashes = ++counts.splash;
  if (p.onPedestrian) counts.soaked++;
});
bus.on('thunder', () => counts.thunder++);
bus.on('weather:change', (p) => (counts.change = `${p.from}→${p.to}`));
W.__weather = weather;
W.__toPuddle = () => {
  const run = findPuddleRun(query, traffic, city.puddleSpots, cruiser.state.pos);
  if (!run) return false;
  cruiser.place(run.lane, run.s);
  cruiser.state.speed = 6.5;
  cruiser.riding = true;
  cam.snap();
  return true;
};

let bench: { run: FxBench; done: (r: FxBenchResult) => void } | null = null;
W.__bench = () => new Promise((done) => (bench = { run: new FxBench((on) => (weather.fxEnabled = on)), done }));

// pre-roll: the weather timeline (wet roads, clouds), then the traffic around the rider
for (let t = 0; t < P.t; t += 1 / 30) weather.timeline.update(1 / 30, 0, 1 - env.night);
const probe = new CameraProbe(query);
cam.update(0, cruiser.state, null);
probe.update(engine.camera, engine.quality.drawDistance);
traffic.setViewProbe(probe);
traffic.warmup(cruiser.state, P.warm, P.intensity);
cam.snap();

let frames = 0;
let elapsed = 0;
new GameLoop({
  step: (dt) => {
    cruiser.update(dt);
    traffic.update(dt, cruiser.state, P.intensity);
  },
  render: (_a, dt) => {
    elapsed += dt;
    const st = cruiser.state;
    weather.update(dt, Math.min(1, elapsed / 300));
    env.update(dt, rig.root.position);
    const w = weather.state;
    traffic.setConditions({ timeOfDay: tod, rain: w.rain });
    const ground = city.groundHeight(st.pos.x, st.pos.z);
    rig.update(dt, st, { lamps: env.lampsOn, night: env.night, groundY: ground, brake: st.accel < -1 ? 1 : 0 });
    const post = shotCam === 'side' ? sideCam() : cam.update(dt, st, null);
    probe.update(engine.camera, engine.quality.drawDistance);
    view.update(traffic, { camera: engine.camera, dt, night: env.night, lamps: env.lampsOn, rain: w.rain, groundHeight: city.groundHeight });
    city.update(dt, { night: env.night, lamps: env.lampsOn, wet: w.wetness, camPos: engine.camera.position, focus: st.pos, signal: (n) => traffic.signal(n) });
    cockpit.setActive(shotCam === 'pov' && cam.povActive);
    cockpit.update(st, Math.abs(st.speed) * KMH, env.night);
    cockpit.renderMirrors(engine.renderer, scene);
    engine.post.set({ ...env.grade(), ...post, wet: weather.lensWet(shotCam === 'pov' && cam.povActive) });
    if (frames === 0) engine.post.snap();
    engine.render();
    if (bench) {
      bench.run.sample(engine.gpu.samples, engine.gpu.lastMs);
      if (bench.run.done) {
        bench.done(bench.run.result());
        bench = null;
      }
    }
    if (++frames % 15 === 0) publish();
    if (frames === 45) W.__ready = true;
  },
}).start();

function publish(): void {
  const f = {
    engine: engine.stats(), weather: weather.state, counts, tod, cam: shotCam, fx: weather.fxEnabled,
    kmh: Math.round(Math.abs(cruiser.state.speed) * KMH), time: weather.timeline.time,
  };
  W.__stats = sandboxStats(f);
  hud.innerHTML = sandboxHud(f);
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') weather.trigger('downpour');
  else if (e.code === 'KeyH') weather.trigger('haze_spike');
  else if (e.code === 'KeyL') weather.strike();
  else if (e.code === 'KeyC') {
    shotCam = SANDBOX_CAMS[(SANDBOX_CAMS.indexOf(shotCam) + 1) % SANDBOX_CAMS.length];
    cam.setMode(shotCam === 'pov' ? 'pov' : 'diorama');
    cam.snap();
  }
  else if (e.code === 'KeyT') env.setTimeOfDay((tod = TODS[(TODS.indexOf(tod) + 1) % TODS.length]), 2.5);
  else if (e.code === 'KeyG') cruiser.riding = !cruiser.riding;
  else if (e.code === 'KeyF') weather.fxEnabled = !weather.fxEnabled;
  else if (e.code === 'KeyQ') engine.setQuality(engine.quality.preset === 'medium' ? 'high' : engine.quality.preset === 'high' ? 'low' : 'medium');
});
