import type { BikeStats, CityQuery, PlayerInput, PlayerState, TrafficQuery } from '../../core/types';
import type { Input } from '../../engine';
import { type BotCommand, type BotMission, RouteBot } from '../../mission';

/**
 * Who rides: the player's devices (Input, polled once per rendered frame) or the `?bot=1` autopilot (RouteBot, once
 * per fixed step: pure pursuit on the route, brakes for traffic, stops at the targets, hands over raincoats / masks).
 * Interact presses latch until the next fixed step consumes them, so a tap between steps is never lost.
 */
export class RideControl {
  readonly bot: RouteBot | null;
  private readonly cmd: BotCommand = { ride: { throttle: 0, brake: 0, steer: 0, tuck: false }, interact: false };
  private interact = false;
  private latest: PlayerInput | null = null;

  constructor(private readonly input: Input, stats: BikeStats, city: CityQuery, bot: boolean) {
    this.bot = bot ? new RouteBot(stats, city) : null;
  }

  /** the last polled device state (null before the first poll) */
  get last(): PlayerInput | null {
    return this.latest;
  }

  /** once per rendered frame while riding: analog controls + edge actions (camera, horn, pause) */
  poll(): PlayerInput {
    const pi = this.input.poll();
    this.latest = pi;
    const r = this.cmd.ride;
    r.throttle = pi.throttle;
    r.brake = pi.brake;
    r.steer = pi.steer;
    r.tuck = pi.tuck;
    this.interact ||= pi.interactPressed;
    return pi;
  }

  /** once per fixed step: what the bike gets (the bot's command, or the latched player input) */
  command(dt: number, s: PlayerState, m: BotMission, traffic: TrafficQuery | null): BotCommand {
    if (this.bot) {
      const c = this.bot.drive(dt, s, m, traffic);
      if (this.interact) c.interact = true;
      this.interact = false;
      return c;
    }
    this.cmd.interact = this.interact;
    this.interact = false;
    return this.cmd;
  }

  /** drop held keys and stale presses (after a pause, a restart or a screen change) */
  reset(): void {
    this.input.reset();
    this.interact = false;
    Object.assign(this.cmd.ride, { throttle: 0, brake: 0, steer: 0, tuck: false });
  }
}
