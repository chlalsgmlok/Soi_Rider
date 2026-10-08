import { type PerspectiveCamera, Scene } from 'three';
import type { EventBus } from '../../core/events';
import { Rng } from '../../core/rng';
import type { CityData, CityQuery, RunConfig, SignalView, Vec2 } from '../../core/types';
import { type Assets, type Engine, Environment } from '../../engine';
import { CameraProbe, capsFor, type PedScare, TrafficSystem, TrafficView } from '../../traffic';
import { buildCityView, type CityFrame, type CityView, createCityQuery } from '../../world';

/** what the city and the traffic visuals need from the run each frame */
export interface WorldLook {
  night: number;
  lamps: number;
  rain: number;
  /** road wetness 0..1 */
  wet: number;
}

/**
 * The run's Bangkok: generated data + CityQuery, the built CityView, the Environment (time of day, weather look),
 * the scene that holds them and the live traffic (simulation, visuals, spawn probe). Lives from the INTRO until the
 * player leaves the RESULTS; a restart keeps it.
 */
export class SessionWorld {
  readonly scene = new Scene();
  readonly query: CityQuery;
  readonly city: CityView;
  readonly env: Environment;
  readonly traffic: TrafficSystem;
  readonly trafficView: TrafficView;
  readonly probe: CameraProbe;
  /** pedestrians startled this step (TrafficSystem.onPedScare → MissionFrame.pedScares) */
  readonly pedScares: PedScare[] = [];
  private readonly cityFrame: CityFrame;

  constructor(engine: Engine, assets: Assets, readonly data: CityData, readonly config: RunConfig, bus: EventBus) {
    this.scene.name = 'run';
    this.query = createCityQuery(data);
    this.env = new Environment(engine.renderer, engine.quality, config.timeOfDay);
    this.env.attach(this.scene);
    this.city = buildCityView(data, { quality: engine.quality, rng: new Rng(config.seed).fork('cityview'), assets });
    this.scene.add(this.city.root);
    this.traffic = new TrafficSystem(this.query, new Rng(config.seed).fork('traffic'), {
      intensity: config.intensity, bus, conditions: { timeOfDay: config.timeOfDay, rain: 0 },
      caps: capsFor(engine.quality, config.intensity),
    });
    this.trafficView = new TrafficView(assets, this.query, { bus });
    this.scene.add(this.trafficView.root);
    this.probe = new CameraProbe(this.query);
    this.traffic.setViewProbe(this.probe);
    this.traffic.onPedScare = (e) => this.pedScares.push(e);
    this.cityFrame = {
      night: 0, lamps: 0, wet: 0, camPos: engine.camera.position, focus: { x: 0, z: 0 },
      signal: (n: number): SignalView | null => this.traffic.signal(n),
    };
  }

  /** per rendered frame (after the camera moved): aim the spawn probe, draw the traffic, animate the city */
  frame(dt: number, camera: PerspectiveCamera, drawDistance: number, look: WorldLook, focus: Vec2): void {
    this.probe.update(camera, drawDistance);
    this.trafficView.update(this.traffic, {
      camera, dt, night: look.night, lamps: look.lamps, rain: look.rain, groundHeight: this.city.groundHeight,
    });
    const f = this.cityFrame;
    f.night = look.night;
    f.lamps = look.lamps;
    f.wet = look.wet;
    f.camPos = camera.position;
    f.focus = focus;
    this.city.update(dt, f);
  }

  dispose(): void {
    this.traffic.onPedScare = null;
    this.trafficView.root.removeFromParent();
    this.trafficView.dispose();
    this.traffic.dispose();
    this.city.root.removeFromParent();
    this.city.dispose();
    this.env.dispose();
    this.scene.clear();
  }
}
