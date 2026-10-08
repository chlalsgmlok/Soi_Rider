import { describe, expect, it } from 'vitest';
import { BIKES } from '../core/config/bikes';
import { VEHICLES } from '../core/config/traffic';
import { EventBus } from '../core/events';
import { Surface, type StaticCollider, type SurfaceKind } from '../core/types';
import { BikePhysics } from '../player/bike-physics';
import { FLAT_ENV } from '../player/ride-env';
import { CollisionSystem } from './collision-system';
import type { CollisionWorld, ContactReport } from './collision-types';
import { obbCircleOverlap } from './sat';
import { StaticTraffic } from './testing/static-traffic';

function world(colliders: StaticCollider[], surface: (x: number, z: number) => SurfaceKind = () => Surface.Road): CollisionWorld {
  return {
    surfaceAt: surface,
    staticNear: (p, r, out) => {
      out.length = 0;
      for (const c of colliders) if (c.circle && Math.hypot(c.circle.cx - p.x, c.circle.cz - p.z) < r + c.circle.r) out.push(c);
      return out.length;
    },
  };
}

/** coast straight along +Z at `kmh` for up to `seconds`, resolving every step */
function coast(bike: BikePhysics, kmh: number, w: CollisionWorld | null, t: StaticTraffic | null, seconds = 3, throttle = 0.2): ContactReport[] {
  const sys = new CollisionSystem();
  const all: ContactReport[] = [];
  bike.state.speed = kmh / 3.6;
  for (let i = 0; i < seconds * 60; i++) {
    bike.step(1 / 60, { throttle, brake: 0, steer: 0, tuck: false }, { ...FLAT_ENV, surfaceAt: w?.surfaceAt ?? FLAT_ENV.surfaceAt });
    all.push(...sys.resolve(bike, w, t));
    t?.update(1 / 60);
  }
  return all;
}

const pole: StaticCollider = { id: 4, tag: 'pole', circle: { cx: 0, cz: 6, r: 0.15 } };

describe('CollisionSystem', () => {
  it('a pole hit at 30 km/h is heavy and drops the rider', () => {
    const bus = new EventBus();
    const falls: string[] = [];
    bus.on('player:fall', (p) => falls.push(p.reason));
    const bike = new BikePhysics(BIKES.cub, bus);
    const hits = coast(bike, 30, world([pole]), null, 1.5);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: 'static', heavy: true, otherId: 4, other: 'pole#4' });
    expect(hits[0].speedKmh).toBeGreaterThan(25);
    expect(falls).toEqual(['static']);
    expect(bike.state.fallen).toBe(true);
  });

  it('a pole tapped at 8 km/h pushes the rider out, slows it, and is reported once', () => {
    const bike = new BikePhysics(BIKES.cub);
    const hits = coast(bike, 8, world([pole]), null, 4, 0);
    expect(hits).toHaveLength(1);
    expect(hits[0].heavy).toBe(false);
    expect(bike.state.fallen).toBe(false);
    expect(obbCircleOverlap(bike.state.obb, pole.circle ?? { cx: 0, cz: 0, r: 0 })).toBeNull();
    expect(bike.state.pos.z).toBeLessThan(6);
  });

  it('mirrors clack against a taxi mirror at the same height, but never fell the rider', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.taxi, 1.33, 3, 0); // taxi right-mirror tip at x 0.33 → overlaps our left mirror (tip 0.38)
    const bike = new BikePhysics(BIKES.cub);
    const hits = coast(bike, 25, null, t, 1.2);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]).toMatchObject({ kind: 'mirror', heavy: false, other: 'taxi#0' });
    expect(bike.state.fallen).toBe(false);
    expect(bike.state.pos.x).toBeLessThan(0); // knocked away from the taxi
  });

  it('rides under a bus mirror that would overlap in plan view', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.bus, -1.7, -2, 0); // bus side at x −0.45 (7 cm past our mirror), its mirror tip at x −0.25
    const bike = new BikePhysics(BIKES.cub);
    bike.teleport({ x: 0, z: -5 }, 0);
    expect(coast(bike, 15, null, t, 1)).toHaveLength(0);
  });

  it('nudges a pedestrian aside and reports a scare', () => {
    const t = new StaticTraffic();
    t.addPedestrian(0.2, 3, Math.PI / 2);
    const bike = new BikePhysics(BIKES.cub);
    const hits = coast(bike, 9, null, t, 1);
    expect(hits[0]).toMatchObject({ kind: 'pedestrian', heavy: false });
    expect(t.nudges.length).toBeGreaterThan(0);
    expect(Math.hypot(t.people[0].pos.x - 0.2, t.people[0].pos.z - 3)).toBeGreaterThan(0.05);
  });

  it('mounting a curb at speed thunks once (front wheel), bounces the bike and costs speed', () => {
    const run = (curb: boolean): { hits: ContactReport[]; peak: number; speed: number } => {
      const w = world([], (_x, z) => (curb && z > 4 ? Surface.Sidewalk : Surface.Road));
      const bike = new BikePhysics(BIKES.cub);
      const sys = new CollisionSystem();
      bike.state.speed = 20 / 3.6;
      let peak = 0;
      const hits: ContactReport[] = [];
      for (let i = 0; i < 90; i++) {
        bike.step(1 / 60, { throttle: 0.3, brake: 0, steer: 0, tuck: false }, { ...FLAT_ENV, surfaceAt: w.surfaceAt });
        hits.push(...sys.resolve(bike, w, null));
        peak = Math.max(peak, bike.state.bounce);
      }
      return { hits, peak, speed: bike.state.speed };
    };
    const curb = run(true);
    const flat = run(false);
    expect(curb.hits.map((h) => h.kind)).toEqual(['curb']);
    expect(flat.hits).toHaveLength(0);
    expect(curb.peak).toBeGreaterThan(0.02);
    expect(curb.speed).toBeLessThan(flat.speed - 0.3);
  });
});
