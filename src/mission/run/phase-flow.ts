import type { MissionPhase } from '../../core/types';

/** §9: stop within this radius of the stop point … */
export const STOP_RADIUS = 4;
/** … slower than this (m/s) … */
export const STOP_SPEED = 1.5;
/** … for this long (s) */
export const STOP_HOLD = 0.6;
/** boarding moment (s) */
export const BOARD_SEC = 2.2;
/** drop-off moment (s) */
export const DROP_SEC = 1.9;
/** a scripted moment whose promise never settles is abandoned after this long (s) */
export const SCENE_CAP = 6;
/** toDropoff → arriving when this close along the route (m) … */
export const ARRIVE_METERS = 40;
/** … or this close in a straight line (m) */
export const ARRIVE_RADIUS = 25;
/** arriving → toDropoff again after overshooting this far (m) */
export const ARRIVE_EXIT = 90;

export interface FlowInput {
  /** straight distance to the current stop point (m) */
  distToTarget: number;
  /** metres left along the route */
  remaining: number;
  /** m/s (signed) */
  speed: number;
  fallen: boolean;
}

/** what happened this step: a new phase, the start of the drop-off moment, or nothing */
export type FlowStep = MissionPhase | 'dropStart' | null;

/**
 * Mission phase machine (docs/GAME_DESIGN.md §9): intro → toPickup → boarding → toDropoff → arriving → complete,
 * any live phase → failed. Pure: the controller turns the returned steps into routes, hooks and bus events.
 */
export class PhaseFlow {
  phase: MissionPhase = 'intro';
  /** the drop-off moment is playing (inside 'arriving') */
  dropping = false;
  /** seconds the stop condition has held */
  hold = 0;
  /** distance to the stop point when the bike settled (smooth-arrival inner ring check) */
  stopDist = Infinity;
  private timer = 0;
  private sceneDone = true;

  get live(): boolean {
    return this.phase !== 'intro' && this.phase !== 'complete' && this.phase !== 'failed';
  }

  /** the passenger rides along (comfort, prompts, chatter) */
  get aboard(): boolean {
    return this.phase === 'toDropoff' || (this.phase === 'arriving' && !this.dropping);
  }

  /** a scripted moment is playing: the app should hold the bike still */
  get scripted(): boolean {
    return this.phase === 'boarding' || this.dropping;
  }

  /** seconds into the current scripted moment */
  get sceneTime(): number {
    return this.scripted ? this.timer : 0;
  }

  start(): FlowStep {
    return this.phase === 'intro' ? this.go('toPickup') : null;
  }

  fail(): FlowStep {
    return this.live || this.phase === 'intro' ? this.go('failed') : null;
  }

  /** a hook returned a promise: hold the moment until `sceneFinished()` */
  awaitScene(): void {
    this.sceneDone = false;
  }

  sceneFinished(): void {
    this.sceneDone = true;
  }

  update(dt: number, i: FlowInput): FlowStep {
    switch (this.phase) {
      case 'toPickup':
        return this.stopped(dt, i) ? this.go('boarding') : null;
      case 'boarding':
        return this.sceneOver(dt) ? this.go('toDropoff') : null;
      case 'toDropoff':
        return i.remaining <= ARRIVE_METERS || i.distToTarget <= ARRIVE_RADIUS ? this.go('arriving') : null;
      case 'arriving':
        if (this.dropping) return this.sceneOver(dt) ? this.go('complete') : null;
        if (this.stopped(dt, i)) {
          this.dropping = true;
          this.timer = 0;
          this.sceneDone = true;
          return 'dropStart';
        }
        return i.remaining > ARRIVE_EXIT && i.distToTarget > ARRIVE_RADIUS ? this.go('toDropoff') : null;
      default:
        return null;
    }
  }

  private stopped(dt: number, i: FlowInput): boolean {
    const inside = i.distToTarget <= STOP_RADIUS && Math.abs(i.speed) < STOP_SPEED && !i.fallen;
    this.hold = inside ? this.hold + dt : 0;
    if (this.hold < STOP_HOLD) return false;
    this.stopDist = i.distToTarget;
    this.hold = 0;
    return true;
  }

  private sceneOver(dt: number): boolean {
    this.timer += dt;
    const min = this.phase === 'boarding' ? BOARD_SEC : DROP_SEC;
    return this.timer >= min && (this.sceneDone || this.timer >= SCENE_CAP);
  }

  private go(next: MissionPhase): MissionPhase {
    this.phase = next;
    this.timer = 0;
    this.hold = 0;
    this.sceneDone = true;
    if (next !== 'arriving') this.dropping = false;
    return next;
  }
}
