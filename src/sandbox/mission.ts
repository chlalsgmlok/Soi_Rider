/**
 * Mission harness: a generated district (real city view), live traffic, the rideable bike (BikePhysics + RiderRig +
 * CameraRig + Input), the gram route ribbon, target pin, waiting passenger, destination flag and the full HUD.
 * URL params: see sandbox/mission.html (seed, district, intensity, tod, job, trait, bot=1, storm=1, smog=1, cam, q …).
 * Exposes window.__ready, window.__stats (phase, progress …) and window.__mission.
 */
import { Scene } from 'three';
import type { CameraPost } from '../camera/camera-pose';
import { BIKES } from '../core/config/bikes';
import { EventBus } from '../core/events';
import { KMH } from '../core/math2d';
import { Rng } from '../core/rng';
import type { CameraMode, DistrictId, PlayerInput, WeatherKind } from '../core/types';
import { Assets, Engine, Environment, GameLoop, Input, isQualityPreset } from '../engine';
import { HudFrame } from '../mission/dev/hud-frame';
import { MissionRide } from '../mission/dev/mission-ride';
import { holdInput, RouteBot } from '../mission/dev/route-bot';
import { sandboxRun } from '../mission/dev/sandbox-run';
import { WeatherStub } from '../mission/dev/weather-stub';
import { MissionController, MissionMarkers, RouteLine } from '../mission';
import { riderRigAssetNames } from '../player';
import { CameraProbe, capsFor, TrafficSystem, TrafficView, trafficAssetNames } from '../traffic';
import { mapSourceFromCity, UI } from '../ui';
import { createCityQuery, DISTRICT_IDS, DISTRICTS, generateCity } from '../world';
import { buildCityView, cityAssetNames, preloadCityFonts } from '../world/build';

interface MissionWindow {
  __ready?: boolean;
  __stats?: Record<string, unknown>;
  __mission?: MissionController;
  /** debugging handles for eval-driven inspection */
  __traffic?: TrafficSystem;
  __bike?: MissionRide['bike'];
  __bus?: EventBus;
}
const W = window as unknown as MissionWindow;
const qs = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (qs.has(k) ? Number(qs.get(k)) : d);
const dev = document.getElementById('ms-dev') as HTMLDivElement;
if (qs.get('dev') === '0') dev.classList.add('hide');

const district = (DISTRICT_IDS.find((d) => d === qs.get('district')) ?? 'sukhumvit') as DistrictId;
const data = generateCity(num('seed', 7), district);
const query = createCityQuery(data);
const { config, job } = sandboxRun(data, qs);
const canvas = document.body.insertBefore(document.createElement('canvas'), document.body.firstChild);
const q = qs.get('q');
const engine = new Engine(canvas, { quality: isQualityPreset(q) ? q : 'medium' });
const scene = new Scene();
const env = new Environment(engine.renderer, engine.quality, config.timeOfDay);
env.attach(scene);
engine.setScene(scene);
const assets = new Assets();
const names = [...new Set([...cityAssetNames(data), ...trafficAssetNames(), ...riderRigAssetNames()])];
await Promise.all([preloadCityFonts(), assets.preload(names, (d, t, n) => (dev.textContent = `loading ${d}/${t} · ${n}`))]);
const city = buildCityView(data, { quality: engine.quality, rng: new Rng(data.seed).fork('cityview'), assets });
scene.add(city.root);

const bus = new EventBus();
const caps = capsFor(engine.quality, config.intensity);
const traffic = new TrafficSystem(query, new Rng(data.seed).fork('traffic'), {
  intensity: config.intensity, bus, conditions: { timeOfDay: config.timeOfDay, rain: 0 },
  caps: { cars: num('cars', caps.cars), motos: num('motos', caps.motos), pedestrians: num('peds', caps.pedestrians) },
});
const view = new TrafficView(assets, query, { bus });
scene.add(view.root);
const probe = new CameraProbe(query);
traffic.setViewProbe(probe);
const pedScares: Array<{ id: number }> = [];
traffic.onPedScare = (e) => pedScares.push(e);

const ui = new UI(document.getElementById('ui') as HTMLElement, { bus });
ui.hud.configure({ topSpeedKmh: BIKES[config.loadout.bike].topSpeed * KMH, timeOfDay: config.timeOfDay, minimap: true });
ui.hud.setMapSource(mapSourceFromCity(data));
ui.hud.bind(bus);
ui.show('hud', {}, 'none');

const ride = new MissionRide(engine, scene, assets, query, config.loadout, bus);
const cam = (['auto', 'diorama', 'pov'] as const).find((c) => c === qs.get('cam'));
if (cam) ride.cam.setMode(cam);
const mission = new MissionController({
  city: query, config, job, bus,
  hooks: {
    board(p, sec) {
      ride.rig.setPassenger(p);
      ride.carry(p);
      ride.cam.eventShot('boarding', null, sec + 0.3);
      return ride.rig.board(sec);
    },
    dismount(_p, sec) {
      ride.cam.eventShot('dropoff', null, sec + 0.4);
      ride.carry(null);
      return ride.rig.dismount(sec);
    },
    care: (poncho, mask) => ride.rig.setCare(poncho, mask),
  },
});
Object.assign(W, { __mission: mission, __traffic: traffic, __bike: ride.bike, __bus: bus });
const routeLine = new RouteLine(city.groundHeight);
scene.add(routeLine.mesh);
const markers = new MissionMarkers(assets, query, city.groundHeight, mission);
scene.add(markers.root);
const weather = new WeatherStub(config.weather, env);
const bot = qs.get('bot') === '1' ? new RouteBot(BIKES[config.loadout.bike], query) : null;
const hudFrame = new HudFrame();
const input = new Input();
let pi: PlayerInput | null = null;
let interact = false;
const manual = { throttle: 0, brake: 0, steer: 0, tuck: false };
// &from=pickup starts parked at the pickup (QA of the second leg)
const start = qs.get('from') === 'pickup' ? mission.pickup : data.spawn;
ride.place(start.pos, start.heading);
traffic.warmup(ride.bike.state, num('warm', 20), config.intensity);
mission.start({ pos: start.pos, heading: start.heading });

// &view=pickup|drop: a spectator camera on the stop point (QA screenshots of the markers)
const watch = qs.get('view') === 'pickup' ? mission.pickup : qs.get('view') === 'drop' ? mission.drop : null;
const spectate = watch ? (): CameraPost => {
  const h = watch.heading;
  engine.camera.position.set(watch.pos.x - Math.sin(h) * 9 - Math.cos(h) * 5, 7.5, watch.pos.z - Math.cos(h) * 9 + Math.sin(h) * 5);
  engine.camera.lookAt(watch.pos.x, 1.2, watch.pos.z);
  return { tiltShift: 0.55, focusY: 0.5, focusBand: 0.14, focusFeather: 0.3 };
} : null;

const loop = new GameLoop({
  step: (dt) => {
    const s = ride.bike.state;
    const cmd = bot?.drive(dt, s, mission, traffic);
    const rideIn = mission.holdBike ? holdInput(s.speed, manual) : cmd ? cmd.ride : manual;
    ride.setWetness(env.weather.rain);
    ride.step(dt, rideIn, traffic);
    traffic.update(dt, s, config.intensity);
    const w = weather.update(dt, mission.tripProgress);
    mission.update(dt, {
      player: s, interact: interact || (cmd?.interact ?? false), contacts: ride.contacts, style: ride.style, pedScares, weather: w, traffic,
    });
    pedScares.length = 0;
    interact = false;
  },
  render: (_a, dt) => {
    pi = input.poll();
    if (pi.cameraPressed) ride.cam.cycleMode();
    if (pi.hornPressed) ride.rig.horn();
    interact ||= pi.interactPressed;
    Object.assign(manual, { throttle: pi.throttle, brake: pi.brake, steer: pi.steer, tuck: pi.tuck });
    loop.timeScale = ride.cam.timeScale;
    const s = ride.bike.state;
    if (!mission.flow.live && mission.phase !== 'intro' && Math.hypot(s.pos.x - mission.pose.pos.x, s.pos.z - mission.pose.pos.z) > 5) ride.rig.setPassenger(null);
    routeLine.setPath(mission.nav.path);
    routeLine.update(dt, mission.nav.s, env.night);
    markers.update(dt, mission, s, engine.camera, ride.cam.povActive);
    env.update(dt, ride.rig.root.position);
    traffic.setConditions({ timeOfDay: config.timeOfDay, rain: env.weather.rain });
    let post = ride.render(dt, { night: env.night, lamps: env.lampsOn, wet: env.weather.rain, groundY: city.groundHeight(s.pos.x, s.pos.z) }, scene);
    if (spectate) post = spectate();
    probe.update(engine.camera, engine.quality.drawDistance);
    view.update(traffic, { camera: engine.camera, dt, night: env.night, lamps: env.lampsOn, rain: env.weather.rain, groundHeight: city.groundHeight });
    city.update(dt, {
      night: env.night, lamps: env.lampsOn, wet: Math.min(1, env.weather.rain * 1.3), camPos: engine.camera.position, focus: s.pos,
      signal: (n) => traffic.signal(n),
    });
    engine.post.set({ ...env.grade(), ...post, wet: ride.cam.povActive ? env.weather.rain : 0 });
    if (frames === 0) engine.post.snap();
    engine.render();
    ui.hud.update(hudFrame.build(mission.hud(), s, ride.clearance.info, engine.camera, {
      city: 'Bangkok', district: DISTRICTS[district].label.en, roadName: query.roadNameAt(s.pos), weather: weatherKind(),
      rain: env.weather.rain, cameraMode: ride.cam.mode as CameraMode, width: innerWidth, height: innerHeight,
      targetScreen: markers.targetScreen(engine.camera, innerWidth, innerHeight),
    }));
    if (++frames % 15 === 0) publish();
    if (frames === 45) W.__ready = true;
  },
});
let frames = 0;
loop.start();

function weatherKind(): WeatherKind {
  if (env.weather.rain > 0.2) return 'rain';
  return mission.care.weather.smoggy || config.weather.base === 'haze' ? 'haze' : config.weather.base;
}

function publish(): void {
  const s = ride.bike.state;
  const st = engine.stats();
  const m = mission.stats;
  W.__stats = {
    phase: mission.phase, progress: +mission.tripProgress.toFixed(3), remaining: Math.round(mission.nav.remaining),
    offRoute: +mission.nav.offRoute.toFixed(2), reroutes: mission.nav.reroutes, kmh: +(Math.abs(s.speed) * KMH).toFixed(1),
    comfort: +mission.comfort.value.toFixed(1), eta: m.etaSec, t: +m.timeSec.toFixed(1), falls: m.falls, bumps: m.bumps,
    mirrors: m.mirrorClips, redLights: m.redLights, nearMisses: mission.style.nearMisses, raincoat: m.raincoat, mask: m.mask,
    botTarget: bot ? +bot.target.toFixed(2) : null, botLimit: bot?.limit ?? null, lane: s.laneId, fps: Math.round(st.fps), drawCalls: st.drawCalls, pos: [+s.pos.x.toFixed(1), +s.pos.z.toFixed(1)],
    trait: job.passenger.trait, pickup: mission.pickup.name, drop: mission.drop.name,
  };
  dev.innerHTML = `<b>${mission.phase}</b> · ${Math.round(mission.nav.remaining)} m · ${(Math.abs(s.speed) * KMH).toFixed(0)} km/h · ` +
    `comfort ${mission.comfort.value.toFixed(0)} · ${st.fps.toFixed(0)} fps · ${st.drawCalls} draws${bot ? ' · bot' : ''}`;
}
