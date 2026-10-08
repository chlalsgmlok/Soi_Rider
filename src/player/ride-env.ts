import { RIDE } from '../core/config/bikes';
import { clamp, lerp } from '../core/math2d';
import { type BikeStats, type LaneHit, type PlayerState, Surface, type SurfaceKind, type Vec2 } from '../core/types';

/** What the road gives the bike each step (docs/ARCHITECTURE.md › player › BikePhysics.step). */
export interface RideEnv {
  /** tyre–road friction μ — RIDE.gripDry … RIDE.gripWet; `gripFor(wetness)` blends them */
  grip: number;
  surfaceAt(x: number, z: number): SurfaceKind;
  /** extra width beside the pillion (a shopper's bags), m */
  extraWidth: number;
  /** lane lookup for counterflow detection (CityQuery.nearestLane) */
  nearestLane?: (p: Vec2, maxDist?: number) => LaneHit | null;
  /** 0..1 extra mass on board (a passenger ≈ 0.6): softer acceleration, longer braking */
  load?: number;
}

/** friction for a road wetness 0 (dry) … 1 (soaked) */
export const gripFor = (wetness: number): number => lerp(RIDE.gripDry, RIDE.gripWet, clamp(wetness, 0, 1));

/** a flat, dry, lane-less ground (tests, garage turntable) */
export const FLAT_ENV: RideEnv = { grip: RIDE.gripDry, surfaceAt: () => Surface.Road, extraWidth: 0 };

export function createPlayerState(stats: BikeStats): PlayerState {
  const obb = { cx: 0, cz: 0, hw: stats.width / 2, hl: stats.length / 2, angle: 0 };
  const mirror = (): PlayerState['obb'] => ({ cx: 0, cz: 0, hw: 0.065, hl: 0.07, angle: 0 });
  return {
    pos: { x: 0, z: 0 }, heading: 0, speed: 0, yawRate: 0, steer: 0, lean: 0, pitch: 0, bounce: 0, slip: 0,
    tuck: false, surface: Surface.Road, obb, mirrors: [mirror(), mirror()], width: stats.mirrorSpan, fallen: false,
    fallTimer: 0, counterflow: false, laneId: -1, accel: 0, feetDown: true,
  };
}

const ROADLIKE = new Set<SurfaceKind>([Surface.Road, Surface.Crosswalk]);

/**
 * Lane under the bike and whether the rider is going against it. Intersections keep the previous verdict
 * (lanes stop at the junction box), surfaces off the carriageway never count as counterflow.
 */
export function laneStatus(s: PlayerState, env: RideEnv): void {
  if (s.surface === Surface.Intersection) return;
  if (!env.nearestLane || !ROADLIKE.has(s.surface)) {
    s.counterflow = false;
    s.laneId = -1;
    return;
  }
  const hit = env.nearestLane(s.pos, 6);
  if (!hit || hit.dist > hit.lane.width / 2 + 0.3) {
    s.counterflow = false;
    s.laneId = -1;
    return;
  }
  s.laneId = hit.lane.id;
  const dir = Math.sign(s.speed) || 1;
  const along = (Math.sin(s.heading) * hit.lane.dir.x + Math.cos(s.heading) * hit.lane.dir.z) * dir;
  s.counterflow = Math.abs(s.speed) > 1 && along < -0.35;
}
