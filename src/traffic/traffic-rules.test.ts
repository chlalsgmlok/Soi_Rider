import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { HONK_AFTER } from './sim/driver-mood';
import { obbPenetration } from './sim/obb-depth';
import { cityQuery, longLane, placeVehicle, riderAt, sidewalkPlayer, STEP, system } from './testing/sim-fixtures';
import { TrafficSystem } from './traffic-system';

/** an empty system (no spawns) with an event bus to listen for horns */
function emptySystem(seed = 1): { sys: TrafficSystem; bus: EventBus; city: ReturnType<typeof cityQuery> } {
  const city = cityQuery(seed, 'sukhumvit');
  const bus = new EventBus();
  const sys = new TrafficSystem(city, new Rng(3), { intensity: 'light', bus, caps: { cars: 0, motos: 0, pedestrians: 0 } });
  return { sys, bus, city };
}

describe('NPCs and the rider', () => {
  it('a car brakes for the rider standing in its lane, stops short of them and honks after 2.5 s', () => {
    const { sys, bus, city } = emptySystem();
    const lane = city.data.lanes[longLane(city)];
    const at = (s: number, lat: number) => ({
      x: lane.start.x + lane.dir.x * s + lane.dir.z * lat, z: lane.start.z + lane.dir.z * s - lane.dir.x * lat,
    });
    const p = at(70, 0);
    const heading = Math.atan2(lane.dir.x, lane.dir.z);
    const rider = riderAt(p.x, p.z, heading, 0);
    const car = placeVehicle(sys, 'sedan', lane.id, 10, 11);
    const horns: number[] = [];
    let t = 0;
    let stoppedAt = -1;
    let blockedAt = -1;
    bus.on('horn', (e) => {
      if (e.by === 'npc') horns.push(t);
    });
    for (; t < 25; t += STEP) {
      sys.update(STEP, rider, 'light');
      expect(obbPenetration(car.obb, rider.obb)).toBe(0);
      if (stoppedAt < 0 && car.speed === 0) stoppedAt = t;
      if (blockedAt < 0 && car.speed < 0.6 && car.leader === 'player') blockedAt = t;
    }
    const gap = 70 - 0.95 - (car.s + car.halfLen);
    expect(car.speed).toBe(0);
    expect(car.track).toBe(lane.id);
    expect(gap).toBeGreaterThan(0.3);
    expect(gap).toBeLessThan(4);
    expect(car.leader).toBe('player');
    expect(stoppedAt).toBeGreaterThan(0);
    expect(horns.length).toBeGreaterThan(0);
    // the horn sounds once the car has been held up (crawling < 0.6 m/s behind the rider) for 2.5 s — not before
    expect(horns[0] - blockedAt).toBeGreaterThanOrEqual(HONK_AFTER - STEP * 2);
    expect(horns[0] - blockedAt).toBeLessThan(HONK_AFTER + 0.5);
  });

  it('also stops when the rider only half blocks the lane (standing 1.1 m off its centre)', () => {
    const { sys, city } = emptySystem();
    const lane = city.data.lanes[longLane(city)];
    const lat = 1.1;
    const x = lane.start.x + lane.dir.x * 60 + lane.dir.z * lat;
    const z = lane.start.z + lane.dir.z * 60 - lane.dir.x * lat;
    const rider = riderAt(x, z, Math.atan2(lane.dir.x, lane.dir.z), 0);
    const car = placeVehicle(sys, 'taxi', lane.id, 8, 10);
    for (let t = 0; t < 20; t += STEP) {
      sys.update(STEP, rider, 'light');
      expect(obbPenetration(car.obb, rider.obb)).toBe(0);
    }
    expect(car.speed).toBe(0);
    expect(car.s + car.halfLen).toBeLessThan(60 - 0.95);
  });

  it('a motorbike filters around or waits — it never rides through the rider', () => {
    const { sys, city } = emptySystem();
    const lane = city.data.lanes[longLane(city)];
    const x = lane.start.x + lane.dir.x * 50;
    const z = lane.start.z + lane.dir.z * 50;
    const rider = riderAt(x, z, Math.atan2(lane.dir.x, lane.dir.z), 0);
    const moto = placeVehicle(sys, 'moto', lane.id, 10, 8, 0);
    let minDist = Infinity;
    for (let t = 0; t < 20; t += STEP) {
      sys.update(STEP, rider, 'light');
      expect(obbPenetration(moto.obb, rider.obb)).toBe(0);
      minDist = Math.min(minDist, Math.hypot(moto.pos.x - x, moto.pos.z - z));
    }
    // it got right up to the rider (filtering past or waiting behind) instead of stopping far away
    expect(minDist).toBeLessThan(3.5);
  });
});

describe('left-hand traffic discipline', () => {
  it('cars keep to their lane on the LEFT of the road centre; motorbikes stay on their side', () => {
    const city = cityQuery(2, 'sukhumvit');
    const sys = system(city, 'rush', 60, 0);
    const player = sidewalkPlayer(city);
    const { lanes, edges, nodes } = city.data;
    let checked = 0;
    for (let step = 0; step < 60 * 60; step++) {
      sys.update(STEP, player, 'rush');
      if (step % 6 !== 0) continue;
      for (const v of sys.vehicles()) {
        if (v.laneId < 0) continue;
        const lane = lanes[v.laneId];
        const e = edges[lane.edge];
        const a = nodes[e.a].pos;
        // signed distance from the road centreline along left(a→b): forward lanes live at > 0
        const side = ((v.pos.x - a.x) * e.dir.z - (v.pos.z - a.z) * e.dir.x) * (lane.forward ? 1 : -1);
        expect(side).toBeGreaterThan(v.isMoto ? 0.1 : e.median / 2 + 0.15);
        if (!v.isMoto && v.laneChange <= 0 && Math.abs(v.lat - v.latTarget) < 0.01) {
          expect(Math.abs(v.lat)).toBeLessThanOrEqual(Math.max(0, (lane.width - v.spec.width) / 2) + 0.05);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5000);
  }, 300_000);
});
