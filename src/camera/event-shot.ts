import { Vector3 } from 'three';
import { clamp } from '../core/math2d';
import type { PlayerState } from '../core/types';
import { fallSide } from '../player/fall-motion';
import type { CamPose } from './camera-pose';

export type EventShotKind = 'boarding' | 'dropoff' | 'fall';

/** slow-motion window at the start of a fall shot (s) and its time scale */
export const FALL_SLOWMO = 0.4;
export const FALL_TIMESCALE = 0.35;

/**
 * Short cinematic shots (docs/GAME_DESIGN.md §12 Event): boarding / drop-off = a slow low orbit around the bike
 * starting on the curb side; fall = a crash cam that swings to the low side and up, with a brief slow-mo hint.
 */
export class EventShot {
  kind: EventShotKind | null = null;
  private t = 0;
  private seconds = 0;
  private startYaw = 0;
  private side = 1;
  private readonly anchor = new Vector3();

  get active(): boolean {
    return this.kind !== null && this.t < this.seconds;
  }

  /** 0..1 blend weight (eases in over 0.35 s, out over the last 0.5 s) */
  get weight(): number {
    if (!this.active) return 0;
    const inW = clamp(this.t / 0.35, 0, 1);
    const outW = clamp((this.seconds - this.t) / 0.5, 0, 1);
    const w = Math.min(inW, outW);
    return w * w * (3 - 2 * w);
  }

  /** suggested GameLoop.timeScale (slow-mo at the start of a fall) */
  get timeScale(): number {
    return this.kind === 'fall' && this.active && this.t < FALL_SLOWMO ? FALL_TIMESCALE : 1;
  }

  start(kind: EventShotKind, s: PlayerState, target: Vector3 | null, seconds: number): void {
    this.kind = kind;
    this.t = 0;
    this.seconds = Math.max(0.5, seconds);
    this.startYaw = s.heading;
    this.side = kind === 'fall' ? fallSide(s) : 1;
    if (target) this.anchor.copy(target);
    else this.anchor.set(s.pos.x, 0, s.pos.z);
  }

  stop(): void {
    this.kind = null;
  }

  /** real-time advance (unaffected by slow-mo) and pose; `follow` keeps the anchor on the moving bike */
  update(dt: number, s: PlayerState, ground: number, out: CamPose, follow = true): CamPose {
    this.t += dt;
    if (follow) this.anchor.set(s.pos.x, ground, s.pos.z);
    const a = this.anchor;
    if (this.kind === 'fall') {
      // swing out to the side the bike fell toward, up and slightly ahead, looking down at the slide
      const u = clamp(this.t / 1.2, 0, 1);
      // yaw θ = behind the bike; θ ± π/2 = its right / left side
      const yaw = this.startYaw + this.side * (Math.PI / 2 - 0.35 + 0.3 * u);
      out.pos.set(a.x - Math.sin(yaw) * (5.2 + u), a.y + 3.4 + u * 0.8, a.z - Math.cos(yaw) * (5.2 + u));
      out.target.set(a.x, a.y + 0.5, a.z);
      out.fov = 44;
      out.roll = 0;
      out.tilt = 0.55;
    } else {
      // front-left 3/4 (the curb side in Thailand), then a slow 29°/s orbit, low and close
      const dir = this.kind === 'boarding' ? 1 : -1;
      const yaw = this.startYaw - Math.PI / 2 - 0.55 + dir * this.t * 0.5;
      out.pos.set(a.x - Math.sin(yaw) * 4.3, a.y + 1.9, a.z - Math.cos(yaw) * 4.3);
      out.target.set(a.x, a.y + 0.95, a.z);
      out.fov = 42;
      out.roll = 0;
      out.tilt = 0.4;
    }
    out.band = 0.2;
    out.feather = 0.3;
    if (!this.active) this.kind = null;
    return out;
  }
}
