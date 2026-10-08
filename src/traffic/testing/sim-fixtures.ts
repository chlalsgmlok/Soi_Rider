import { VEHICLES } from '../../core/config/traffic';
import { Rng } from '../../core/rng';
import type { CityQuery, DistrictId, TrafficIntensity, VehicleKind } from '../../core/types';
import { Surface } from '../../core/types';
import { createCityQuery } from '../../world';
import { city as fixtureCity } from '../../world/gen/test-fixtures';
import { extendRoute } from '../sim/route';
import type { TrafficPlayer } from '../sim/types';
import { temperament, paintVehicle } from '../sim/vehicle-mix';
import type { Vehicle } from '../sim/vehicle';
import { TrafficSystem } from '../traffic-system';

/** Test-only helpers for headless traffic simulations. */

export const STEP = 1 / 60;

export function cityQuery(seed: number, district: DistrictId): CityQuery {
  return createCityQuery(fixtureCity(seed, district));
}

/** true when no carriageway cell lies within `r` metres of (x, z) */
function offRoad(city: CityQuery, x: number, z: number, r: number): boolean {
  for (let dx = -r; dx <= r; dx += 0.5) {
    for (let dz = -r; dz <= r; dz += 0.5) {
      const s = city.surfaceAt(x + dx, z + dz);
      if (s === Surface.Road || s === Surface.Intersection || s === Surface.Crosswalk) return false;
    }
  }
  return true;
}

/**
 * A rider parked on the sidewalk beside the first signalised junction, its whole hull at least 2 m from any
 * carriageway — the busiest place in town without blocking a single lane.
 */
export function sidewalkPlayer(city: CityQuery): TrafficPlayer {
  const node = city.data.nodes.find((n) => n.signal) ?? city.data.nodes[0];
  for (let r = node.radius; r < 80; r += 0.5) {
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const x = node.pos.x + Math.cos(a) * r;
      const z = node.pos.z + Math.sin(a) * r;
      if (city.surfaceAt(x, z) === Surface.Sidewalk && offRoad(city, x, z, 3)) return riderAt(x, z, 0, 0);
    }
  }
  return riderAt(node.pos.x, node.pos.z, 0, 0);
}

export function riderAt(x: number, z: number, heading: number, speed: number): TrafficPlayer {
  return { pos: { x, z }, heading, speed, obb: { cx: x, cz: z, hw: 0.36, hl: 0.95, angle: heading } };
}

export function system(city: CityQuery, intensity: TrafficIntensity, cars: number, peds: number, seed = 5): TrafficSystem {
  return new TrafficSystem(city, new Rng(seed), { intensity, bus: null, caps: { cars, pedestrians: peds }, audit: true });
}

/** place one vehicle by hand (empty system: caps 0) on a lane at arc length s */
export function placeVehicle(sys: TrafficSystem, kind: VehicleKind, lane: number, s: number, speed: number, lat = 0): Vehicle {
  const core = sys.core;
  const v = core.pool.spawn(VEHICLES[kind], kind === 'moto');
  v.track = lane;
  v.s = s;
  temperament(v, 'light', new Rng(lane + 1));
  paintVehicle(v, new Rng(lane + 2));
  v.jitter = 0;
  v.lat = v.latTarget = lat;
  v.speed = speed;
  extendRoute(v, core.tracks, core.ctx.rng, v.pos);
  v.place(core.tracks);
  return v;
}

/** longest straight lane of a class (main roads are 3.2 m wide, ≥ 80 m long) */
export function longLane(city: CityQuery, min = 90): number {
  const lanes = city.data.lanes.filter((l) => l.length >= min).sort((a, b) => b.length - a.length);
  return lanes[0]?.id ?? 0;
}
