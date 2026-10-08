import { clamp, wrapAngle } from '../../core/math2d';
import type {
  BikeStats, CityQuery, MissionPhase, PlayerState, PromptState, TrafficAgentView, TrafficQuery, Vec2,
} from '../../core/types';
import type { RideInput } from '../../player/bike-physics';
import { maxSteerAt } from '../../player/ride-steering';
import type { Navigator } from '../nav/navigator';
import { BotFilter } from './bot-filter';
import { BOT_BRAKE, obstacleSpeed, signalSpeed } from './bot-limits';

/** what the bot reads from the mission (MissionController satisfies it) */
export interface BotMission {
  readonly nav: Navigator;
  readonly phase: MissionPhase;
  readonly holdBike: boolean;
  readonly prompt: PromptState | null;
}

export interface BotCommand {
  ride: RideInput;
  /** press interact this step (prompts) */
  interact: boolean;
}

export type BotLimit = 'cruise' | 'corner' | 'stop' | 'obstacle' | 'signal' | 'hold';

/** cruising speed (m/s, 30 km/h) */
const CRUISE = 8.3;

/** input that keeps a stopped bike still (a held brake at a standstill would walk it backwards) */
export function holdInput(speed: number, out: RideInput): RideInput {
  out.throttle = 0;
  out.brake = Math.abs(speed) > 0.25 ? 1 : 0;
  out.steer = 0;
  out.tuck = false;
  return out;
}

/**
 * Autopilot for headless runs (?bot=1): pure pursuit on the route polyline (look-ahead grows with speed), slows for
 * corners ahead, red / amber lights and anything in its corridor, filters past queues (BotFilter), stops at the
 * pickup / drop and hands raincoats and masks over when a prompt opens.
 */
export class RouteBot {
  readonly cmd: BotCommand = { ride: { throttle: 0, brake: 0, steer: 0, tuck: false }, interact: false };
  /** the speed aimed for this step and what limits it (debug readout) */
  target = 0;
  limit: BotLimit = 'hold';
  private readonly look: Vec2 = { x: 0, z: 0 };
  private readonly tan: Vec2 = { x: 0, z: 1 };
  private readonly now: Vec2 = { x: 0, z: 1 };
  private readonly scratch: TrafficAgentView[] = [];
  private readonly filter: BotFilter;
  private pressed = false;
  /** the corridor straight off the bike's nose was blocked last step */
  private noseBlocked = false;

  constructor(private readonly stats: BikeStats, private readonly city: CityQuery) {
    this.filter = new BotFilter(city, this.scratch);
  }

  drive(dt: number, s: PlayerState, m: BotMission, traffic: TrafficQuery | null): BotCommand {
    const c = this.cmd;
    c.interact = false;
    this.limit = 'hold';
    const path = m.nav.path;
    const live = m.phase !== 'intro' && m.phase !== 'complete' && m.phase !== 'failed';
    if (!live || m.holdBike || !path || s.fallen) return this.hold(s);
    if (m.prompt) {
      if (Math.abs(s.speed) < 0.8 && !this.pressed) c.interact = this.pressed = true;
      return this.hold(s);
    }
    this.pressed = false;
    if (this.filter.backFor > 0) {
      // wedged: walk the bike back a step (a held brake at a standstill walks it backwards)
      this.filter.backFor -= dt;
      Object.assign(c.ride, { throttle: 0, brake: 1, steer: 0, tuck: false });
      return c;
    }
    const v = Math.max(0, s.speed);
    this.steer(s, v, m.nav);
    path.tangentAt(m.nav.s, this.now);
    let corner = CRUISE;
    for (let d = 4; d <= 28; d += 4) {
      path.tangentAt(Math.min(path.length, m.nav.s + d), this.tan);
      const turn = Math.acos(clamp(this.tan.x * this.now.x + this.tan.z * this.now.z, -1, 1));
      const slow = clamp(8.5 - 5.2 * turn, 3, CRUISE);
      corner = Math.min(corner, Math.sqrt(slow * slow + 2 * BOT_BRAKE * Math.max(0, d - 5)));
    }
    const stop = Math.sqrt(2 * 1.4 * Math.max(0, m.nav.remaining - 1.2));
    const obstacle = traffic ? this.obstacles(s, traffic) : Infinity;
    const signal = traffic ? signalSpeed(s, this.city, traffic) : Infinity;
    const target = Math.min(CRUISE, corner, stop, obstacle, signal);
    this.limit = target === signal ? 'signal' : target === obstacle ? 'obstacle' : target === stop ? 'stop'
      : target === corner ? 'corner' : 'cruise';
    this.target = target;
    const wedged = target > 1 && v < 0.3;
    this.filter.update({ dt, speed: v, blocked: obstacle < 0.6 && signal > 1, wedged, tangent: this.now }, s, traffic);
    this.throttle(target, v);
    return c;
  }

  private hold(s: PlayerState): BotCommand {
    holdInput(s.speed, this.cmd.ride);
    return this.cmd;
  }

  private throttle(target: number, v: number): void {
    const r = this.cmd.ride;
    const err = target - v;
    r.tuck = false;
    r.throttle = 0;
    r.brake = 0;
    if (target < 0.3 && v < 0.25) return;
    if (err > 0.25) r.throttle = clamp(err * 0.45, 0.12, 1);
    else if (err < -0.25) r.brake = clamp(-err * 0.4, 0.08, 1);
    else r.throttle = 0.1;
  }

  private steer(s: PlayerState, v: number, nav: Navigator): void {
    const p = nav.path;
    if (!p) return;
    const shift = this.filter.shift;
    const ld = shift !== 0 && v < 2.5 ? 2.5 : clamp(3.2 + 0.5 * v, 4, 11);
    const at = Math.min(p.length, nav.s + ld);
    p.pointAt(at, this.look);
    p.tangentAt(at, this.tan);
    // right of the path = (−t.z, t.x)
    this.look.x += -this.tan.z * shift;
    this.look.z += this.tan.x * shift;
    if (shift !== 0 && v < 1.8 && this.noseBlocked) {
      // filtering from a standstill: pivot on the feet toward the gap until the nose clears the queued car
      this.cmd.ride.steer = Math.sign(shift);
      return;
    }
    const dx = this.look.x - s.pos.x;
    const dz = this.look.z - s.pos.z;
    const alpha = wrapAngle(s.heading - Math.atan2(dx, dz));
    if (v < 1.8) {
      this.cmd.ride.steer = clamp(alpha * 1.6, -1, 1);
      return;
    }
    const kappa = (2 * Math.sin(alpha)) / Math.max(1, Math.hypot(dx, dz));
    this.cmd.ride.steer = clamp(Math.atan(kappa * this.stats.wheelbase) / maxSteerAt(this.stats, v), -1, 1);
  }

  /** corridor checks along the bike's nose and toward the look-ahead point (where it is about to go) */
  private obstacles(s: PlayerState, traffic: TrafficQuery): number {
    const dx = this.look.x - s.pos.x;
    const dz = this.look.z - s.pos.z;
    const l = Math.hypot(dx, dz);
    const nose = obstacleSpeed(s, Math.sin(s.heading), Math.cos(s.heading), traffic, this.scratch, 0);
    this.noseBlocked = nose < 0.6;
    // squeezing out of a queue at walking pace only the nose decides (the bike pivots toward the gap first)
    if (this.filter.shift !== 0 && s.speed < 2.5) return nose;
    return l > 1 ? Math.min(nose, obstacleSpeed(s, dx / l, dz / l, traffic, this.scratch, 0)) : nose;
  }
}
