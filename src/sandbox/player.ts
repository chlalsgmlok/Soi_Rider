/**
 * Player harness: the real bike physics, collisions, clearance/style sensors, rider rig, POV cockpit and camera rig
 * on an asphalt arena with queued real vehicles (0.95–1.25 m gaps), NPC motos, pedestrians and poles.
 * URL: ?bike=cub|scooter|sport &cam=auto|diorama|pov &wet=0|1 &tod=morning|noon|sunset|night &q=low|medium|high
 *      &autopilot=squeeze|turn|fall &passenger=1 &outfit=<OutfitId> &color=<color key>
 * Keys: WASD/arrows ride · Space tuck · H horn · C camera · 1-3 bike · R rain · N time of day · P passenger
 *       B board · V dismount · F fall · T restart
 * Exposes window.__ready, window.__stats, window.__pause(on).
 */
import { type PerspectiveCamera, Scene } from 'three';
import { BIKES } from '../core/config/bikes';
import { TRAITS } from '../core/config/scoring';
import { EventBus } from '../core/events';
import { KMH } from '../core/math2d';
import { CameraRig } from '../camera/camera-rig';
import { Assets } from '../engine/assets/assets';
import { Engine } from '../engine/engine';
import { Environment } from '../engine/env/environment';
import { Input } from '../engine/input/input';
import { GameLoop } from '../engine/loop';
import { ClearanceSensor } from '../physics/clearance-sensor';
import { CollisionSystem } from '../physics/collision-system';
import { StyleSensor } from '../physics/style-sensor';
import { StaticTraffic } from '../physics/testing/static-traffic';
import { bindArenaKeys } from '../player/arena/arena-keys';
import { arenaParams, TODS } from '../player/arena/arena-params';
import { ARENA_PASSENGER, PLAYER_START } from '../player/arena/arena-layout';
import { arenaAssetNames, buildArena } from '../player/arena/arena-scene';
import { arenaStats } from '../player/arena/arena-stats';
import { ArenaWorld } from '../player/arena/arena-world';
import { Autopilot } from '../player/arena/autopilot';
import { DebugPanel } from '../player/arena/debug-panel';
import { BikePhysics, type RideInput } from '../player/bike-physics';
import { PovCockpit } from '../player/cockpit/pov-cockpit';
import { gripFor, type RideEnv } from '../player/ride-env';
import { RiderRig } from '../player/rig/rider-rig';

interface SandboxWindow {
  /** debugging handles for eval-driven inspection */
  __rig?: RiderRig;
  __camera?: PerspectiveCamera;
  __ready?: boolean;
  __stats?: Record<string, number | string | boolean>;
  __pause?: (on: boolean) => void;
}
const W = window as unknown as SandboxWindow;
const P = arenaParams(location.search);
const { loadout, scenario } = P;
let { tod, wet } = P;

const hud = document.getElementById('pl-hud') as HTMLDivElement;
const canvas = document.body.insertBefore(document.createElement('canvas'), document.body.firstChild);
const engine = new Engine(canvas, { quality: P.quality });
const scene = new Scene();
const env = new Environment(engine.renderer, engine.quality, tod);
env.attach(scene);
const setWeather = (blend: number): void => env.setWeather({ rain: wet ? 0.85 : 0, overcast: wet ? 0.8 : 0, haze: 0 }, blend);
setWeather(0);
engine.setScene(scene);
const assets = new Assets();
await assets.preload(arenaAssetNames(), (done, total, name) => (hud.textContent = `loading ${done}/${total} · ${name}`));

const bus = new EventBus();
const traffic = new StaticTraffic();
const arena = buildArena(assets, traffic);
scene.add(arena.root);
const world = new ArenaWorld();
const bike = new BikePhysics(BIKES[P.bike], bus);
const rig = new RiderRig(assets, loadout, engine.quality);
scene.add(rig.root);
Object.assign(W, { __rig: rig, __camera: engine.camera });
const cockpit = new PovCockpit(rig, engine.quality);
cockpit.attach(engine.camera);
const cam = new CameraRig(engine.camera);
cam.setWorld(world);
cam.setMode(P.cam);
engine.onQualityChange((q) => [env, rig, cockpit].forEach((o) => o.setQuality(q)));
const collisions = new CollisionSystem();
const clearance = new ClearanceSensor();
const style = new StyleSensor();
const panel = new DebugPanel(hud);
const input = new Input();
let pilot = scenario ? new Autopilot(scenario, bike.stats) : null;
let ride: RideInput = { throttle: 0, brake: 0, steer: 0, tuck: false };
let lastContact = '';
let contactCount = 0;
let simTime = 0;
let riding = false;
const rideEnv: RideEnv = { grip: gripFor(wet), surfaceAt: (x, z) => world.surfaceAt(x, z), extraWidth: 0, nearestLane: world.nearestLane };
/** a shopper on the back: bags widen the bike and the extra mass softens acceleration and braking */
const carry = (on: boolean): void => {
  riding = on;
  rideEnv.extraWidth = on ? TRAITS[ARENA_PASSENGER.trait].extraWidth : 0;
  rideEnv.load = on ? 0.6 : 0;
  rig.setPassenger(on ? ARENA_PASSENGER : null, { poncho: wet === 1 });
};
if (P.passenger) carry(true);

function restart(): void {
  const st = scenario?.start ?? PLAYER_START;
  bike.teleport({ x: st.x, z: st.z }, st.heading);
  collisions.reset();
  style.reset();
  pilot = scenario ? new Autopilot(scenario, bike.stats) : null;
  cam.snap();
}
restart();

bus.on('player:fall', () => {
  cam.eventShot('fall', null, 2.3);
  cam.shake(0.8, 0.6);
});

const loop = new GameLoop({
  step: (dt) => {
    simTime += dt;
    if (pilot) {
      const a = pilot.update(bike.state, clearance.info);
      ride = a;
      if (a.horn) rig.horn();
    }
    bike.step(dt, ride, rideEnv);
    const contacts = collisions.resolve(bike, world, traffic, dt);
    traffic.update(dt);
    clearance.sense(bike, world, traffic);
    panel.note(contacts, style.step(dt, bike, clearance, contacts, traffic));
    for (const c of contacts) {
      contactCount++;
      lastContact = `${c.kind}${c.heavy ? '!' : ''} ${c.other} ${c.speedKmh.toFixed(0)}km/h`;
      if (!c.heavy) cam.shake(c.kind === 'curb' ? 0.25 : 0.4, 0.3);
    }
  },
  render: (_alpha, frameDt) => {
    // a paused sim freezes the animation clocks too (screenshots), but the post stack keeps settling
    const dt = loop.paused ? 0 : frameDt;
    const pi = input.poll();
    if (!pilot) ride = { throttle: pi.throttle, brake: pi.brake, steer: pi.steer, tuck: pi.tuck };
    if (pi.cameraPressed) cam.cycleMode();
    if (pi.hornPressed) rig.horn();
    loop.timeScale = cam.timeScale;
    env.update(dt, rig.root.position);
    arena.setLamps(env.lampsOn, env.night);
    arena.setWet(env.weather.rain);
    arena.sync();
    rig.update(dt, bike.state, { steer: ride.steer, brake: ride.brake, lamps: env.lampsOn, night: env.night });
    const post = cam.update(dt, bike.state, clearance.info);
    cockpit.setActive(cam.povActive);
    cockpit.update(bike.state, Math.abs(bike.state.speed) * KMH, env.night);
    cockpit.renderMirrors(engine.renderer, scene);
    engine.post.set({ ...env.grade(), ...post, wet: cam.povActive ? env.weather.rain : 0 });
    engine.render();
    publish(frameDt);
  },
});
loop.start();
W.__pause = (on) => (on ? loop.pause() : loop.resume());

let frames = 0;
function publish(dt: number): void {
  frames++;
  if (frames === 45) W.__ready = true;
  const st = engine.stats();
  const phase = pilot ? pilot.phase : 'manual';
  panel.update(dt, bike.state, clearance.info,
    `${cam.mode}${cam.squeeze.active ? ' · squeeze' : ''} · ${rig.pose} · ${phase} · ${st.fps.toFixed(0)} fps · ${st.drawCalls} draws`);
  W.__stats = arenaStats({
    t: simTime, s: bike.state, clearance: clearance.info, contacts: contactCount, lastContact, pose: rig.pose,
    mode: cam.mode, squeeze: cam.squeeze.level, phase, bike: loadout.bike, engine: st, camera: engine.camera.position,
  });
}

bindArenaKeys({
  bike(id) {
    loadout.bike = id;
    bike.setStats(BIKES[id]);
    rig.applyLoadout(loadout);
    cockpit.rebind();
  },
  rain() {
    wet = wet ? 0 : 1;
    rideEnv.grip = gripFor(wet);
    setWeather(2);
  },
  timeOfDay: () => env.setTimeOfDay((tod = TODS[(TODS.indexOf(tod) + 1) % TODS.length]), 2),
  passenger: () => carry(!riding),
  board() {
    carry(true);
    void rig.board();
    cam.eventShot('boarding', null, 2.4);
  },
  dismount() {
    void rig.dismount();
    cam.eventShot('dropoff', null, 2.2);
  },
  fall: () => bike.fall('debug'),
  restart,
});
