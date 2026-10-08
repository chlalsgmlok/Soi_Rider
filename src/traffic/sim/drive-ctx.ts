import type { EventBus } from '../../core/events';
import type { Rng } from '../../core/rng';
import type { Vec2 } from '../../core/types';
import type { CorridorScanner } from './corridor';
import type { JunctionGate } from './junction-gate';
import type { LaneLists } from './lane-lists';
import type { Obstacles } from './obstacles';
import type { Track, Tracks } from './tracks';
import type { ExhaustPuff } from './types';
import type { Vehicle } from './vehicle';

/** Shared state every driver step reads (one per TrafficSystem, mutated in place each fixed step). */
export interface DriveCtx {
  readonly tracks: Tracks;
  readonly gate: JunctionGate;
  readonly scanner: CorridorScanner;
  readonly lists: LaneLists;
  readonly obstacles: Obstacles;
  readonly rng: Rng;
  readonly bus: EventBus | null;
  /** INTENSITY.flow — desired-speed multiplier */
  flow: number;
  dt: number;
  /** the rider's position (route bias, lane-change safety) */
  readonly focus: Vec2;
  /** obstacle index of the rider this step (-1 none) */
  playerIndex: number;
  onExhaust: ((e: ExhaustPuff) => void) | null;
}

/** lowest cruise speed a car will settle for on a free road even in gridlock (m/s) */
const CAR_FLOOR = 2.4;

/**
 * Desired speed on the current track: the road's limit × intensity flow × the driver's temperament, capped by the
 * vehicle's top speed and — on connectors — by the curve. Motorbikes keep more of their speed in jams.
 */
export function desiredSpeed(v: Vehicle, t: Track, ctx: DriveCtx): number {
  const lane = t.lane >= 0 ? t : ctx.tracks.get(t.next[0]);
  const flow = v.isMoto ? Math.min(1, ctx.flow + 0.35) : ctx.flow;
  let v0 = Math.max(CAR_FLOOR, lane.speedLimit * flow) * v.v0;
  v0 = Math.min(v0, v.spec.maxSpeed);
  if (t.lane < 0) v0 = Math.min(v0, t.speedLimit * (v.isMoto ? 1.15 : 1));
  return Math.max(1.2, v0);
}
