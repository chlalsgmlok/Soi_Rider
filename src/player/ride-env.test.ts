import { describe, expect, it } from 'vitest';
import { BIKES } from '../core/config/bikes';
import { EventBus } from '../core/events';
import { type Lane, type LaneHit, Surface, type SurfaceKind, type Vec2 } from '../core/types';
import { BikePhysics } from './bike-physics';
import { createPlayerState, FLAT_ENV, laneStatus, type RideEnv } from './ride-env';

/** a two-lane road along Z: lane 0 runs +Z at x 1.75 (Thailand keeps LEFT, +X = left), lane 1 runs −Z at x −1.75 */
function lane(id: number, x: number, dirZ: 1 | -1): Lane {
  return {
    id, edge: 0, forward: dirZ > 0, index: 0, start: { x, z: -100 * dirZ }, end: { x, z: 100 * dirZ },
    dir: { x: 0, z: dirZ }, length: 200, width: 3.5, offset: x, speedLimit: 14, out: [], in: [],
  };
}
const LANES = [lane(0, 1.75, 1), lane(1, -1.75, -1)];

function nearestLane(p: Vec2, maxDist = 6): LaneHit | null {
  let best: LaneHit | null = null;
  for (const l of LANES) {
    const dist = Math.abs(p.x - l.offset);
    if (dist > maxDist || (best && best.dist <= dist)) continue;
    best = { lane: l, s: (p.z - l.start.z) * l.dir.z, lateral: (p.x - l.offset) * l.dir.z, dist };
  }
  return best;
}

const env = (surface: SurfaceKind = Surface.Road): RideEnv => ({ ...FLAT_ENV, surfaceAt: () => surface, nearestLane });

function at(x: number, heading: number, speed: number, surface: SurfaceKind = Surface.Road): ReturnType<typeof createPlayerState> {
  const s = createPlayerState(BIKES.cub);
  s.pos = { x, z: 0 };
  s.heading = heading;
  s.speed = speed;
  s.surface = surface;
  return s;
}

describe('laneStatus — counterflow via nearestLane', () => {
  it('riding with the traffic in the own lane is fine; the oncoming lane is counterflow', () => {
    const own = at(1.75, 0, 8);
    laneStatus(own, env());
    expect(own).toMatchObject({ laneId: 0, counterflow: false });
    const oncoming = at(-1.75, 0, 8);
    laneStatus(oncoming, env());
    expect(oncoming).toMatchObject({ laneId: 1, counterflow: true });
    // turned around in the oncoming lane = riding with it
    const turned = at(-1.75, Math.PI, 8);
    laneStatus(turned, env());
    expect(turned.counterflow).toBe(false);
  });

  it('crossing at an angle, creeping (≤ 1 m/s) and rolling backwards do not count', () => {
    const crossing = at(-1.75, Math.PI / 2, 8); // 90° across the lanes
    laneStatus(crossing, env());
    expect(crossing.counterflow).toBe(false);
    const creeping = at(-1.75, 0, 0.8);
    laneStatus(creeping, env());
    expect(creeping.counterflow).toBe(false);
    const walkBack = at(-1.75, Math.PI, -0.9); // facing with the lane, pushed back on the brake
    laneStatus(walkBack, env());
    expect(walkBack.counterflow).toBe(false);
  });

  it('sidewalks and lane-less ground clear the verdict; the junction box keeps it', () => {
    const s = at(-1.75, 0, 8);
    laneStatus(s, env());
    expect(s.counterflow).toBe(true);
    s.surface = Surface.Intersection;
    laneStatus(s, env(Surface.Intersection));
    expect(s).toMatchObject({ counterflow: true, laneId: 1 });
    s.surface = Surface.Sidewalk;
    laneStatus(s, env(Surface.Sidewalk));
    expect(s).toMatchObject({ counterflow: false, laneId: -1 });
    const far = at(-6.5, 0, 8); // 4.75 m off the lane centre: beyond half a lane + 0.3
    laneStatus(far, env());
    expect(far).toMatchObject({ counterflow: false, laneId: -1 });
  });

  it('BikePhysics announces counterflow and sidewalk riding on the bus (edges only)', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on('counterflow', (e) => seen.push(`counterflow:${e.active}`));
    bus.on('sidewalk', (e) => seen.push(`sidewalk:${e.active}`));
    const b = new BikePhysics(BIKES.cub, bus);
    b.teleport({ x: -1.75, z: 0 }, 0);
    let surface: SurfaceKind = Surface.Road;
    const live: RideEnv = { ...FLAT_ENV, nearestLane, surfaceAt: () => surface };
    for (let i = 0; i < 30; i++) {
      b.state.speed = 6;
      b.step(1 / 60, { throttle: 0, brake: 0, steer: 0, tuck: false }, live);
    }
    expect(b.state.counterflow).toBe(true);
    surface = Surface.Sidewalk;
    for (let i = 0; i < 30; i++) {
      b.state.speed = 6;
      b.step(1 / 60, { throttle: 0, brake: 0, steer: 0, tuck: false }, live);
    }
    expect(seen).toEqual(['counterflow:true', 'sidewalk:true', 'counterflow:false']);
  });
});
