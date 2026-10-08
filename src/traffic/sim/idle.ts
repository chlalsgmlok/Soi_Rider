import type { DriveCtx } from './drive-ctx';
import type { Vehicle } from './vehicle';

/** a standing vehicle re-plans on one fixed step out of this many (it still ages, waits and honks every step) */
export const IDLE_EVERY = 3;

/**
 * Cheap step for a vehicle standing still: nothing can move it until its next full plan, so skip the corridor
 * sweep, gate and integration and only advance its timers. Saves most of the cost of a gridlocked street.
 */
export function idleTick(v: Vehicle, ctx: DriveCtx): boolean {
  if (v.speed > 0 || v.idleSkip <= 0 || v.laneChange > 0 || v.nudgeVel !== 0) return false;
  if (Math.abs(v.latTarget - v.lat) > 1e-3 || (v.wantGo && v.startDelay <= 0)) return false;
  const dt = ctx.dt;
  v.idleSkip--;
  v.age += dt;
  if (!v.heldByLight) v.stuck += dt;
  if (v.atGate) v.wait += dt;
  if (v.wantGo && v.startDelay > 0) v.startDelay -= dt;
  v.honkCooldown -= dt;
  v.honkLeft -= dt;
  v.honking = v.honkLeft > 0;
  v.latVel = 0;
  return true;
}

/** after a full step: standing vehicles may idle for the next IDLE_EVERY − 1 steps */
export function armIdle(v: Vehicle, wantGo: boolean): void {
  v.wantGo = wantGo;
  v.idleSkip = v.speed === 0 ? IDLE_EVERY - 1 : 0;
}
