import type { WeatherPlan } from '../../core/types';
import type { Environment } from '../../engine/env/environment';
import type { MissionWeather } from '../run/mission-types';

/** a downpour's build-up before the full rain (s) — docs/GAME_DESIGN.md §7 */
const BUILD_UP = 6;

/**
 * Dev stand-in for src/weather in the mission sandbox: starts the plan's events at their trip progress, sets the
 * Environment sky / rain / smog and reports the MissionWeather the controller reads (with explicit event flags).
 */
export class WeatherStub {
  readonly state: MissionWeather = { rain: 0, haze: 0, downpour: false, hazeSpike: false };
  private readonly started: number[];
  private readonly clock: number[];
  private applied = '';

  constructor(private readonly plan: WeatherPlan, private readonly env: Environment) {
    this.started = plan.events.map(() => 0);
    this.clock = plan.events.map(() => 0);
    env.setWeather({ rain: 0, haze: plan.haze, overcast: plan.base === 'overcast' ? 0.6 : 0 }, 0);
  }

  update(dt: number, tripProgress: number): MissionWeather {
    let rain = 0;
    let spike = 0;
    let downpour = false;
    let hazeSpike = false;
    this.plan.events.forEach((e, i) => {
      if (!this.started[i] && tripProgress >= e.atProgress) this.started[i] = 1;
      if (!this.started[i]) return;
      this.clock[i] += dt;
      const t = this.clock[i];
      if (t > e.duration) return;
      if (e.kind === 'downpour') {
        downpour = true;
        rain = t < BUILD_UP ? 0.15 * (t / BUILD_UP) : e.intensity;
      } else {
        hazeSpike = true;
        spike = e.intensity * 0.5;
      }
    });
    const key = `${rain > 0.2 ? 1 : rain > 0 ? 0.5 : 0}|${spike}`;
    if (key !== this.applied) {
      this.applied = key;
      const overcast = rain > 0 ? 0.85 : this.plan.base === 'overcast' ? 0.6 : 0;
      this.env.setWeather({ rain: rain > 0.2 ? rain : rain > 0 ? 0.12 : 0, haze: Math.min(1, this.plan.haze + spike), overcast }, rain > 0.2 ? 3 : 4);
    }
    const s = this.state;
    s.rain = this.env.weather.rain;
    s.haze = this.env.weather.haze;
    s.downpour = downpour;
    s.hazeSpike = hazeSpike;
    return s;
  }
}
