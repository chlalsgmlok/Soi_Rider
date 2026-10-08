import { Vector3 } from 'three';
import type { CameraPost } from '../../camera';
import type { RunConfig } from '../../core/types';
import type { Engine, PostFxParams } from '../../engine';
import { holdInput, type MissionFrame } from '../../mission';
import type { RideInput } from '../../player';
import type { TrafficConditions } from '../../traffic';
import type { RideAudio } from './ride-audio';
import type { RideControl } from './ride-control';
import type { RideLook, RideStack } from './ride-stack';
import type { RunWeather } from './run-weather';
import type { SessionRun } from './session-run';
import type { SessionWorld, WorldLook } from './session-world';

/** the RESULTS backdrop orbit around the parked rider */
const OUTRO_ORBIT = { radius: 9, height: 5.5, speed: 0.06, fov: 40, lookUp: 0.9, tilt: 0.75 } as const;
/** orbit start relative to the bike heading: a three-quarter front view */
const OUTRO_YAW = 2.5;

/**
 * The PLAY frame order (docs/ARCHITECTURE.md + docs/briefs/wiring-notes.md) for one attempt:
 * fixed step = controls/bot → bike → collisions → sensors → traffic → mission; rendered frame = weather → env →
 * rig + camera (or the results orbit) → route + markers → traffic + city visuals → post → engine sound.
 */
export class SessionLoop {
  private readonly hold: RideInput = { throttle: 0, brake: 0, steer: 0, tuck: false };
  private readonly look: RideLook = { night: 0, lamps: 0, groundY: 0 };
  private readonly target = new Vector3();
  private readonly orbitOpts = { ...OUTRO_ORBIT, start: 0 };
  private readonly worldLook: WorldLook = { night: 0, lamps: 0, rain: 0, wet: 0 };
  private readonly conditions: TrafficConditions;
  private readonly postIn: Partial<PostFxParams> = {};
  private readonly mf: MissionFrame;
  private outroT = 0;

  constructor(private readonly engine: Engine, private readonly config: RunConfig, private readonly world: SessionWorld,
    private readonly ride: RideStack, private readonly control: RideControl, private readonly sound: RideAudio) {
    this.conditions = { timeOfDay: config.timeOfDay, rain: 0 };
    this.mf = {
      player: ride.bike.state, interact: false, contacts: [], style: [], pedScares: world.pedScares, traffic: world.traffic,
      weather: { rain: 0, haze: 0 },
    };
  }

  /** one fixed 60 Hz step; `parked` holds the bike still (results) */
  step(dt: number, run: SessionRun, weather: RunWeather, parked: boolean): void {
    const { world: w, ride } = this;
    const m = run.mission;
    const s = ride.bike.state;
    const cmd = this.control.command(dt, s, m, w.traffic);
    const input = parked || !m.flow.live || m.holdBike ? holdInput(s.speed, this.hold) : cmd.ride;
    ride.setWet(weather.system.wetness);
    ride.step(dt, input, w.traffic, w.query);
    w.traffic.update(dt, s, this.config.intensity);
    const f = this.mf;
    f.interact = cmd.interact;
    f.contacts = ride.contacts;
    f.style = ride.style;
    f.weather = weather.mission();
    m.update(dt, f);
    w.pedScares.length = 0;
  }

  /** one rendered frame (dt = 0 while paused: everything holds still but keeps drawing); `outro` = results orbit */
  frame(dt: number, run: SessionRun, weather: RunWeather, outro: boolean): void {
    const { engine, world: w, ride } = this;
    const s = ride.bike.state;
    const wx = weather.system;
    wx.update(dt, run.mission.tripProgress);
    w.env.update(dt, ride.rig.root.position);
    const ws = wx.state;
    this.conditions.rain = ws.rain;
    w.traffic.setConditions(this.conditions);
    const look = this.look;
    look.night = w.env.night;
    look.lamps = w.env.lampsOn;
    look.groundY = w.city.groundHeight(s.pos.x, s.pos.z);
    const post = outro ? this.orbit(dt) : ride.render(dt, look, w.scene);
    const pov = !outro && ride.cam.povActive;
    run.frame(dt, engine.camera, look.night, s, pov);
    const wl = this.worldLook;
    wl.night = look.night;
    wl.lamps = look.lamps;
    wl.rain = ws.rain;
    wl.wet = ws.wetness;
    w.frame(dt, engine.camera, engine.quality.drawDistance, wl, s.pos);
    const p = Object.assign(this.postIn, w.env.grade(), post);
    p.wet = wx.lensWet(pov);
    engine.post.set(p);
    this.sound.update(s, ride.input, ws.wetness, run.mission.aboard);
  }

  /** the results orbit starts over (a fresh three-quarter view) */
  resetOutro(): void {
    this.outroT = 0;
  }

  private orbit(dt: number): CameraPost {
    this.outroT += dt;
    const s = this.ride.bike.state;
    this.target.set(s.pos.x, this.look.groundY, s.pos.z);
    this.orbitOpts.start = s.heading + OUTRO_YAW;
    return this.ride.orbit(dt, this.look, this.target, this.outroT, this.orbitOpts);
  }
}
