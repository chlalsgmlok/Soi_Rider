import { RIDE } from '../core/config/bikes';
import type { EventBus } from '../core/events';
import type { PlayerState } from '../core/types';
import type { Spring } from './spring';

/** a downed bike rests on bars + peg at this roll (rad) */
export const FALL_LEAN = 1.3;
/** the last part of RIDE.fallDuration is the rider picking the bike up (s) */
export const GETUP_TIME = 0.95;
/** sliding on its side scrubs speed this fast (m/s²) */
const SLIDE_DECEL = 6.5;
/** below this lean (rad) the bike counts as upright and goes down toward its steering instead */
const UPRIGHT = 0.05;
/** a fall starts at least this far over to the fall side, so sign(lean) names the side for the whole fall */
const FALL_START_LEAN = 0.06;

/**
 * The side a bike going down NOW falls to (+1 = right, −1 = left): its lean, or — nearly upright — its steering
 * (right when dead straight). Physics, the rider's tumble and the crash cam all use this one rule; once a fall has
 * started, the lean is nudged past UPRIGHT so it keeps answering the same side until the get-up.
 */
export function fallSide(s: Pick<PlayerState, 'lean' | 'steer'>): 1 | -1 {
  return (Math.abs(s.lean) > UPRIGHT ? s.lean : s.steer) < 0 ? -1 : 1;
}

/**
 * The fall → slide → get-up sequence. The bike drops toward the side it was leaning (or steering), slides to a
 * stop while spinning a little, lies there, and is lifted upright during the last GETUP_TIME seconds.
 */
export class FallMotion {
  /** +1 = fell to the right, −1 = to the left */
  side: 1 | -1 = 1;

  constructor(
    private readonly s: PlayerState,
    private readonly lean: Spring,
    private readonly bus: EventBus | null,
  ) {}

  start(reason: string): void {
    const s = this.s;
    if (s.fallen) return;
    const side = fallSide(s);
    this.side = side;
    // commit the lean to the fall side (no swing back through upright) before anyone reads it
    if (s.lean * side < FALL_START_LEAN) s.lean = side * FALL_START_LEAN;
    this.lean.reset(s.lean, side * Math.max(0, this.lean.v * side));
    s.fallen = true;
    s.fallTimer = RIDE.fallDuration;
    s.tuck = false;
    s.feetDown = false;
    s.slip = 0;
    s.yawRate = s.yawRate * 0.5 - side * Math.min(1.2, Math.abs(s.speed) * 0.08);
    this.bus?.emit('player:fall', { reason });
  }

  step(dt: number): void {
    const s = this.s;
    s.fallTimer = Math.max(0, s.fallTimer - dt);
    const v = Math.abs(s.speed);
    s.speed = Math.sign(s.speed) * Math.max(0, v - SLIDE_DECEL * dt);
    s.yawRate *= Math.exp(-2.5 * dt);
    s.heading += s.yawRate * dt;
    s.pos.x += Math.sin(s.heading) * s.speed * dt;
    s.pos.z += Math.cos(s.heading) * s.speed * dt;
    const rising = s.fallTimer < GETUP_TIME;
    s.lean = rising
      ? this.lean.step(0, dt, 6, 1)
      : this.lean.step(this.side * FALL_LEAN, dt, 7.5, 0.55);
    if (s.fallTimer > 0) return;
    s.fallen = false;
    s.speed = 0;
    s.yawRate = 0;
    s.steer = 0;
    s.lean = 0;
    this.lean.reset();
    s.feetDown = true;
    this.bus?.emit('player:recover', {});
  }
}
