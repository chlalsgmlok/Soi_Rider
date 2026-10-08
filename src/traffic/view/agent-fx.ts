import { angleDiff, clamp, damp, G } from '../../core/math2d';
import type { Vehicle } from '../sim/vehicle';

/** how long a clipped mirror stays folded before swinging back (s) */
const FOLD_HOLD = 1.4;
const UNFOLD_RATE = 1.8;

/** Per-vehicle animation state the simulation does not carry: wheel roll, steering, lean, mirror folds. */
export class AgentFx {
  spin = 0;
  steer = 0;
  lean = 0;
  prevHeading = 0;
  foldL = 0;
  foldR = 0;
  holdL = 0;
  holdR = 0;
  stamp = 0;
  fresh = true;

  update(v: Vehicle, dt: number, wheelRadius: number, wheelbase: number): void {
    if (this.fresh) {
      this.prevHeading = v.heading;
      this.fresh = false;
    }
    const yawRate = dt > 0 ? angleDiff(this.prevHeading, v.heading) / dt : 0;
    this.prevHeading = v.heading;
    this.spin = (this.spin + (v.speed * dt) / Math.max(0.15, wheelRadius)) % (Math.PI * 2);
    const sp = Math.max(0.8, v.speed);
    const steer = clamp(Math.atan((wheelbase * yawRate) / sp), -0.55, 0.55);
    this.steer += (steer - this.steer) * damp(8, dt);
    // positive lean = leaning RIGHT (yaw rate > 0 is a left turn)
    const lean = v.isMoto ? clamp(-Math.atan((v.speed * yawRate) / G), -0.5, 0.5) : 0;
    this.lean += (lean - this.lean) * damp(6, dt);
    this.holdL -= dt;
    this.holdR -= dt;
    if (this.holdL <= 0) this.foldL = Math.max(0, this.foldL - UNFOLD_RATE * dt);
    if (this.holdR <= 0) this.foldR = Math.max(0, this.foldR - UNFOLD_RATE * dt);
  }

  fold(left: boolean): void {
    if (left) {
      this.foldL = 1;
      this.holdL = FOLD_HOLD;
    } else {
      this.foldR = 1;
      this.holdR = FOLD_HOLD;
    }
  }
}

/** AgentFx per vehicle id, created on first sight and dropped once the vehicle is gone */
export class AgentFxTable {
  private readonly map = new Map<number, AgentFx>();
  private readonly free: AgentFx[] = [];
  private frame = 0;

  begin(): void {
    this.frame++;
  }

  get(id: number): AgentFx {
    let fx = this.map.get(id);
    if (!fx) {
      fx = this.free.pop() ?? new AgentFx();
      fx.spin = fx.steer = fx.lean = fx.foldL = fx.foldR = fx.holdL = fx.holdR = 0;
      fx.fresh = true;
      this.map.set(id, fx);
    }
    fx.stamp = this.frame;
    return fx;
  }

  peek(id: number): AgentFx | undefined {
    return this.map.get(id);
  }

  /** recycle entries of vehicles not seen this frame */
  sweep(): void {
    this.map.forEach((fx, id) => {
      if (fx.stamp === this.frame) return;
      this.map.delete(id);
      this.free.push(fx);
    });
  }
}
