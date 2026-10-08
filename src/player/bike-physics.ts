import { RIDE } from '../core/config/bikes';
import type { EventBus } from '../core/events';
import { angleDiff, clamp, damp, G } from '../core/math2d';
import { type BikeStats, type PlayerInput, type PlayerState, Surface, type Vec2 } from '../core/types';
import type { CollisionBody, ContactResponse } from '../physics/collision-types';
import { FallMotion } from './fall-motion';
import { RideAnnouncer } from './ride-announcer';
import { createPlayerState, laneStatus, type RideEnv } from './ride-env';
import { updateHull } from './ride-hull';
import { forwardAccel } from './ride-longitudinal';
import { gripYaw, type GripYaw, maxSteerAt, steerToward } from './ride-steering';
import { Spring } from './spring';

export type RideInput = Pick<PlayerInput, 'throttle' | 'brake' | 'steer' | 'tuck'>;

/** feet-down paddling turns the bike on the spot up to this yaw rate (rad/s) */
const PIVOT_RATE = 1.15;
/** brake held this long at a standstill starts walking the bike backwards (s) */
const WALK_DELAY = 0.35;

/**
 * Arcade-real motorbike (docs/GAME_DESIGN.md §5): bicycle steering with a speed-dependent lock, friction-circle
 * grip (understeer + slip past μg), lean as a weighted 2nd-order spring, brake dive / throttle squat, curb and
 * tile bounce, feet-down pivot below 2 m/s, walk-back on a held brake, tuck, falls with a recovery timer.
 * Implements the physics CollisionBody so CollisionSystem can push it around.
 */
export class BikePhysics implements CollisionBody {
  readonly state: PlayerState;
  /** last step's inputs (the rig uses them for the bars, brake light, horn hand) */
  readonly control = { throttle: 0, brake: 0, steer: 0 };
  /** 0..1 how hard the tyres are sliding this step (audio squeal, rig wobble) */
  skid = 0;
  private readonly lean = new Spring(RIDE.leanOmega, RIDE.leanZeta);
  private readonly pitch = new Spring(10, 0.45);
  private readonly bounce = new Spring(15, 0.32);
  private readonly grip: GripYaw = { yawRate: 0, overshoot: 0 };
  private readonly fallMotion: FallMotion;
  private brakeHeld = 0;
  private tile = 0;
  private extraWidth = 0;
  private readonly announcer: RideAnnouncer;

  constructor(public stats: BikeStats, bus: EventBus | null = null) {
    this.state = createPlayerState(stats);
    this.fallMotion = new FallMotion(this.state, this.lean, bus);
    this.announcer = new RideAnnouncer(bus);
    updateHull(this.state, stats, 0);
  }

  /** swap bikes (garage) keeping the pose */
  setStats(stats: BikeStats): void {
    this.stats = stats;
    updateHull(this.state, stats, this.extraWidth);
  }

  step(dt: number, input: RideInput, env: RideEnv): void {
    const s = this.state;
    this.extraWidth = env.extraWidth;
    s.surface = env.surfaceAt(s.pos.x, s.pos.z);
    this.control.throttle = input.throttle;
    this.control.brake = input.brake;
    this.control.steer = input.steer;
    if (s.fallen) {
      this.fallMotion.step(dt);
      this.settle(dt, 0);
      s.accel = 0;
      this.skid = 0;
      this.announcer.update(s);
      updateHull(s, this.stats, this.extraWidth);
      return;
    }
    s.tuck = input.tuck;
    const v0 = s.speed;
    const slow = Math.abs(v0) < RIDE.feetDownBelow;

    s.steer = steerToward(s.steer, input.steer, maxSteerAt(this.stats, v0), s.tuck, dt);
    gripYaw(v0, s.steer, this.stats.wheelbase, env.grip, s.accel, this.grip);
    let yaw = this.grip.yawRate;
    if (slow && !s.tuck) yaw -= clamp(input.steer, -1, 1) * PIVOT_RATE * (1 - Math.abs(v0) / RIDE.feetDownBelow);
    this.skid = clamp(this.grip.overshoot * 2, 0, 1);
    const slipTarget = Math.sign(s.steer) * Math.min(0.35, this.grip.overshoot * 0.3);
    s.slip += (slipTarget - s.slip) * damp(8, dt);

    let a = this.longitudinal(dt, input, env, v0);
    a -= Math.sign(v0) * Math.min(3, 2.2 * this.grip.overshoot);
    let v = v0 + a * dt;
    if (v0 >= 0 && v < 0 && this.brakeHeld <= WALK_DELAY) v = 0;
    s.speed = v;
    s.accel = (v - v0) / dt;
    s.yawRate = yaw;
    s.heading += yaw * dt;
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const drift = -s.slip * Math.abs(v) * 0.35 * dt; // a sliding front runs wide
    s.pos.x += fx * v * dt - fz * drift;
    s.pos.z += fz * v * dt + fx * drift;

    const leanTarget = clamp(-Math.atan((v * yaw) / G), -RIDE.maxLean, RIDE.maxLean);
    const k = slow ? (Math.abs(v) / RIDE.feetDownBelow) ** 2 : 1;
    s.lean = this.lean.step(leanTarget * k, dt);
    this.settle(dt, s.accel);
    s.feetDown = slow;
    this.surfaceBumps(dt);
    laneStatus(s, env);
    this.announcer.update(s);
    updateHull(s, this.stats, this.extraWidth);
  }

  /** vertical bounce impulse (m/s, + = up) — curbs, potholes, speed bumps */
  impulse(v: number): void {
    this.bounce.v += v;
  }

  displace(dx: number, dz: number): void {
    this.state.pos.x += dx;
    this.state.pos.z += dz;
    updateHull(this.state, this.stats, this.extraWidth);
  }

  /** contact velocity response: kill the into-obstacle component, lose speed, kick the heading along the deflection */
  collide(nx: number, nz: number, r: ContactResponse): void {
    const s = this.state;
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const vx = fx * s.speed;
    const vz = fz * s.speed;
    const vn = vx * nx + vz * nz;
    if (vn >= 0) return;
    const ox = vx - nx * vn * (1 + r.restitution);
    const oz = vz - nz * vn * (1 + r.restitution);
    const fwd = (ox * fx + oz * fz) * (1 - r.speedLoss);
    s.speed = Math.max(fwd, Math.min(0, s.speed) - 0.6);
    if (Math.hypot(ox, oz) > 0.5 && r.yawKick > 0) {
      const target = Math.atan2(ox, oz) + (s.speed < 0 ? Math.PI : 0);
      s.heading += clamp(angleDiff(s.heading, target) * r.yawKick, -0.3, 0.3);
    }
    this.bounce.v += Math.min(0.6, -vn * 0.05);
    updateHull(s, this.stats, this.extraWidth);
  }

  slow(fraction: number): void {
    this.state.speed *= 1 - clamp(fraction, 0, 1);
  }

  /** planar shove (e.g. an NPC bumps the rider): changes speed along the heading */
  push(dv: Vec2): void {
    const s = this.state;
    s.speed += dv.x * Math.sin(s.heading) + dv.z * Math.cos(s.heading);
  }

  fall(reason: string): void {
    this.fallMotion.start(reason);
    updateHull(this.state, this.stats, this.extraWidth);
  }

  teleport(pos: Vec2, heading: number): void {
    const s = this.state;
    s.pos.x = pos.x;
    s.pos.z = pos.z;
    s.heading = heading;
    s.speed = s.yawRate = s.steer = s.lean = s.pitch = s.bounce = s.slip = s.accel = 0;
    s.fallen = false;
    s.fallTimer = 0;
    s.feetDown = true;
    this.lean.reset();
    this.pitch.reset();
    this.bounce.reset();
    this.brakeHeld = 0;
    updateHull(s, this.stats, this.extraWidth);
  }

  private longitudinal(dt: number, input: RideInput, env: RideEnv, v: number): number {
    const load = env.load ?? 0;
    const holding = input.brake > 0.5 && input.throttle < 0.1 && v < 0.25;
    this.brakeHeld = holding ? this.brakeHeld + dt : 0;
    if (this.brakeHeld > WALK_DELAY) return clamp((-RIDE.walkBackSpeed - v) * 5, -2, 2);
    if (v < -0.02) return clamp(-v * 4, 0, 3) + input.throttle * this.stats.accel * 0.5;
    return forwardAccel(this.stats, input.throttle, input.brake, v, env.grip, input.tuck, load);
  }

  /** pitch (dive / squat) and suspension bounce */
  private settle(dt: number, accel: number): void {
    const s = this.state;
    s.pitch = this.pitch.step(clamp(-accel * 0.011, -0.035, 0.085), dt);
    s.bounce = this.bounce.step(0, dt);
  }

  /** sidewalk tiles drum under the tyres */
  private surfaceBumps(dt: number): void {
    const s = this.state;
    const walk = s.surface === Surface.Sidewalk || s.surface === Surface.Plaza;
    if (!walk || Math.abs(s.speed) < 1.5) return;
    this.tile += Math.abs(s.speed) * dt;
    if (this.tile > 0.6) {
      this.tile -= 0.6;
      this.bounce.v += 0.05 + 0.05 * Math.min(1, Math.abs(s.speed) / 8);
    }
  }
}
