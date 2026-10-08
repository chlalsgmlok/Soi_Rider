import { KMH } from '../core/math2d';
import { Surface, type SurfaceKind } from '../core/types';
import type { CollisionBody, CollisionWorld, ContactReport } from './collision-types';

/** height of a raised surface above the carriageway (m) — the curb step */
export const CURB_HEIGHT = 0.16;

/** raised surfaces: crossing their edge is a curb */
export function isRaised(s: SurfaceKind): boolean {
  return s === Surface.Sidewalk || s === Surface.Median || s === Surface.Building;
}

/** below this speed the rider rolls over a curb carefully: small bounce, no report (m/s) */
const CAREFUL = 10 / KMH;

/**
 * Curb transitions under each wheel via `surfaceAt`. Front wheel mounting/dropping at speed reports a 'curb'
 * contact with a vertical thunk and a speed loss; the rear wheel follows with a smaller bounce only.
 */
export class CurbDetector {
  private front = -1;
  private rear = -1;

  reset(): void {
    this.front = -1;
    this.rear = -1;
  }

  step(body: CollisionBody, world: CollisionWorld, out: ContactReport[]): void {
    const s = body.state;
    const half = body.stats.wheelbase / 2;
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    const front = world.surfaceAt(s.pos.x + fx * half, s.pos.z + fz * half);
    const rear = world.surfaceAt(s.pos.x - fx * half, s.pos.z - fz * half);
    const speed = Math.abs(s.speed);
    const frontLead = s.speed >= 0;
    if (this.front >= 0 && isRaised(front) !== isRaised(this.front as SurfaceKind)) {
      this.cross(body, isRaised(front), speed, frontLead, out, fx * half, fz * half);
    }
    if (this.rear >= 0 && isRaised(rear) !== isRaised(this.rear as SurfaceKind)) {
      this.cross(body, isRaised(rear), speed, !frontLead, out, -fx * half, -fz * half);
    }
    this.front = front;
    this.rear = rear;
  }

  /** `leading` = the wheel that hits the step first in the direction of travel (it takes the big jolt) */
  private cross(
    body: CollisionBody, up: boolean, speed: number, leading: boolean, out: ContactReport[], ox: number, oz: number,
  ): void {
    if (body.state.fallen) return;
    const k = Math.min(1, speed / 9);
    const jolt = (up ? 1.1 : 0.45) * k * (leading ? 1 : 0.55);
    body.impulse(jolt + (up ? 0.15 : 0));
    if (!leading || speed < CAREFUL) return;
    if (up) {
      // climbing the step costs speed (the tyre has to roll up 16 cm)
      body.slow(0.05 + 0.07 * k);
    }
    out.push({
      kind: 'curb', heavy: false, speedKmh: speed * KMH, otherId: -1, key: -1, other: 'curb',
      point: { x: body.state.pos.x + ox, z: body.state.pos.z + oz },
    });
  }
}
