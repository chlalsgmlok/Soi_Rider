import { describe, expect, it } from 'vitest';
import { BIKES } from '../core/config/bikes';
import { VEHICLES } from '../core/config/traffic';
import { BikePhysics } from '../player/bike-physics';
import { FLAT_ENV } from '../player/ride-env';
import { ClearanceSensor } from './clearance-sensor';
import { CollisionSystem } from './collision-system';
import type { ContactReport } from './collision-types';
import { StyleSensor } from './style-sensor';
import type { StyleEvent } from './style-events';
import { STATIC_PED_ID_BASE, StaticTraffic } from './testing/static-traffic';

const DT = 1 / 60;

interface Run {
  bike: BikePhysics;
  hits: ContactReport[];
  style: StyleEvent[];
  /** tightest left clearance seen (m) */
  minLeft: number;
}

/** ride straight up +Z from z −6 at `kmh` (speed held until the first contact), resolving, sensing and scoring */
function run(t: StaticTraffic, x: number, kmh: number, seconds = 2): Run {
  const bike = new BikePhysics(BIKES.cub);
  bike.teleport({ x, z: -6 }, 0);
  const sys = new CollisionSystem();
  const clear = new ClearanceSensor();
  const sensor = new StyleSensor();
  const hits: ContactReport[] = [];
  const style: StyleEvent[] = [];
  let minLeft = Infinity;
  for (let i = 0; i < seconds / DT; i++) {
    if (hits.length === 0) bike.state.speed = kmh / 3.6;
    bike.step(DT, { throttle: 0, brake: 0, steer: 0, tuck: false }, FLAT_ENV);
    const c = sys.resolve(bike, null, t);
    hits.push(...c);
    minLeft = Math.min(minLeft, clear.sense(bike, null, t).left);
    style.push(...sensor.step(DT, bike, clear, c, t));
    t.update(DT);
  }
  return { bike, hits, style, minLeft };
}

describe('NPC motos and pedestrians', () => {
  it('rear-ending a queued moto at 20.8 km/h is heavy: the rider falls and the moto is shoved ahead', () => {
    const t = new StaticTraffic();
    const moto = t.addVehicle(VEHICLES.moto, 0, 0, 0);
    const bystander = t.addPedestrian(9, 0, 0); // far away; shares index 0 with the moto
    const { bike, hits } = run(t, 0, 20.8, 1.2);
    const hit = hits.find((h) => h.kind === 'moto');
    expect(hit).toMatchObject({ kind: 'moto', heavy: true, otherId: moto.id });
    expect(hit?.speedKmh).toBeCloseTo(20.8, 0);
    expect(bike.state.fallen).toBe(true);
    expect(t.nudges.some((n) => n.id === moto.id && n.impulse.z > 0.5)).toBe(true);
    expect(moto.pos.z).toBeGreaterThan(0.2);
    // the shove went to the moto only: ids are one space (pedestrians from STATIC_PED_ID_BASE)
    expect(bystander.id).toBe(STATIC_PED_ID_BASE);
    expect(bystander.pos).toEqual({ x: 9, z: 0 });
    expect(bystander.startled).toBe(0);
  });

  it('a slow tap on a moto (below RIDE.fallSpeedKmh) only nudges it', () => {
    const t = new StaticTraffic();
    t.addVehicle(VEHICLES.moto, 0, 0, 0);
    const { bike, hits } = run(t, 0, 8, 3);
    expect(hits.filter((h) => h.kind === 'moto')).toHaveLength(1);
    expect(hits[0].heavy).toBe(false);
    expect(bike.state.fallen).toBe(false);
  });

  it('buzzing a pedestrian at 12 cm and 20 km/h earns no style (a pedestrian threat, not a near miss)', () => {
    const t = new StaticTraffic();
    // cub mirror tip at x 0.38; a 0.28 m pedestrian centred at 0.78 leaves 12 cm
    t.addPedestrian(0.38 + 0.12 + 0.28, 0, 0);
    const ped = run(t, 0, 20);
    expect(ped.hits).toHaveLength(0);
    expect(ped.minLeft).toBeLessThan(0.2);
    expect(ped.style.filter((e) => e.kind === 'nearMiss')).toHaveLength(0);
    // the same 12 cm mirror-to-mirror past a parked moto (mirror tip at x 0.9 − 0.4 = 0.5) pays once
    const t2 = new StaticTraffic();
    t2.addVehicle(VEHICLES.moto, 0.38 + 0.12 + VEHICLES.moto.mirrorSpan / 2, 0, 0, { queued: false });
    const moto = run(t2, 0, 20);
    expect(moto.hits).toHaveLength(0);
    const nm = moto.style.filter((e) => e.kind === 'nearMiss');
    expect(nm).toHaveLength(1);
    if (nm[0].kind === 'nearMiss') expect(nm[0].clearanceCm).toBeCloseTo(12, 3);
  });
});
