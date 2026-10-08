import type { EventBus } from '../../core/events';
import { Rng } from '../../core/rng';
import type { RunConfig } from '../../core/types';
import type { Engine, QualitySettings } from '../../engine';
import type { MissionWeather } from '../../mission';
import { WeatherSystem } from '../../weather';
import type { RideStack } from './ride-stack';
import type { SessionWorld } from './session-world';

/**
 * The run's WeatherSystem (timeline → Environment, rain / haze / wet-road FX, thunder) wired to the city, the traffic
 * (tyre spray, bus exhaust) and the rider (spray, puddle splashes, glossy rain gear), plus the MissionWeather view
 * the mission reads. `reset` starts the plan over (restart from the win stand).
 */
export class RunWeather {
  system: WeatherSystem;
  private readonly mw: MissionWeather = { rain: 0, haze: 0, downpour: false, hazeSpike: false };

  constructor(private readonly engine: Engine, private readonly world: SessionWorld, private readonly ride: RideStack,
    private readonly config: RunConfig, private readonly bus: EventBus) {
    this.system = this.create();
    world.traffic.onExhaust = (e) => this.system.emitExhaust(e.pos, e.heading, e.strength);
  }

  reset(): void {
    this.system.dispose();
    this.system = this.create();
  }

  /** what MissionController.update reads (explicit event flags from the timeline phase) */
  mission(): MissionWeather {
    const s = this.system.state;
    const mw = this.mw;
    mw.rain = s.rain;
    mw.haze = s.haze;
    mw.downpour = s.kind === 'rain';
    mw.hazeSpike = s.phase === 'smog';
    return mw;
  }

  setQuality(q: QualitySettings): void {
    this.system.setQuality(q);
  }

  dispose(): void {
    this.world.traffic.onExhaust = null;
    this.system.dispose();
  }

  private create(): WeatherSystem {
    const w = this.world;
    return new WeatherSystem(this.config.weather, {
      env: w.env, scene: w.scene, camera: this.engine.camera, quality: this.engine.quality,
      rng: new Rng(this.config.seed).fork('weather'), bus: this.bus, city: w.city, traffic: w.traffic,
      trafficView: w.trafficView, rider: this.ride.bike.state, glossy: [this.ride.rig.root],
    });
  }
}
