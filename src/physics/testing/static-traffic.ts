import type {
  OBB, PedestrianView, SignalView, TrafficAgentView, TrafficQuery, Vec2, VehicleSpec,
} from '../../core/types';
import { SpatialHash } from '../spatial-hash';
import { agentHull } from './agent-hull';

/** pedestrian ids start here, sharing one id space with vehicles like TrafficSystem's (src/traffic PED_ID_BASE) */
export const STATIC_PED_ID_BASE = 1_000_000;

/** A parked / queued NPC whose pose only changes when it is shoved. */
export interface StaticAgent extends TrafficAgentView {
  pos: Vec2;
  heading: number;
  speed: number;
  obb: OBB;
  mirrors: OBB[];
  queued: boolean;
  /** shove velocity (m/s) decaying back to rest */
  push: Vec2;
}

export interface StaticPedestrian extends PedestrianView {
  pos: Vec2;
  heading: number;
  speed: number;
  startled: number;
  push: Vec2;
}

/**
 * TrafficQuery over hand-placed, standing vehicles and pedestrians (unit tests, the player sandbox arena).
 * `nudge` gives motos and pedestrians a decaying shove; cars and vans don't budge. `update(dt)` applies shoves.
 */
export class StaticTraffic implements TrafficQuery {
  readonly list: StaticAgent[] = [];
  readonly people: StaticPedestrian[] = [];
  /** every nudge received (tests read it) */
  readonly nudges: Array<{ id: number; impulse: Vec2 }> = [];
  private readonly hash = new SpatialHash<StaticAgent>(4);
  private dirty = true;

  addVehicle(spec: VehicleSpec, x: number, z: number, heading: number, opts: { paint?: string; queued?: boolean } = {}): StaticAgent {
    const hull = agentHull(spec, x, z, heading);
    const a: StaticAgent = {
      id: this.list.length, kind: spec.kind, spec, pos: { x, z }, heading, speed: 0, obb: hull.obb, mirrors: hull.mirrors,
      braking: true, indicator: 0, honking: false, paint: opts.paint ?? spec.paints[0][0], paint2: spec.paints[0][1],
      look: this.list.length * 7919, laneId: -1, queued: opts.queued ?? true, push: { x: 0, z: 0 },
    };
    this.list.push(a);
    this.dirty = true;
    return a;
  }

  addPedestrian(x: number, z: number, heading: number, radius = 0.28): StaticPedestrian {
    const p: StaticPedestrian = {
      id: STATIC_PED_ID_BASE + this.people.length, pos: { x, z }, heading, speed: 0, radius, crossing: false, startled: 0,
      look: this.people.length * 104729, push: { x: 0, z: 0 },
    };
    this.people.push(p);
    return p;
  }

  agents(): readonly TrafficAgentView[] {
    return this.list;
  }

  near(p: Vec2, r: number, out: TrafficAgentView[]): number {
    if (this.dirty) this.rebuild();
    const tmp = out as StaticAgent[];
    this.hash.queryCircle(p.x, p.z, r, tmp);
    let n = 0;
    for (const a of tmp) if ((a.pos.x - p.x) ** 2 + (a.pos.z - p.z) ** 2 <= r * r) tmp[n++] = a;
    tmp.length = n;
    return n;
  }

  pedestrians(): readonly PedestrianView[] {
    return this.people;
  }

  signal(): SignalView | null {
    return null;
  }

  nudge(id: number, impulse: Vec2): void {
    this.nudges.push({ id, impulse: { x: impulse.x, z: impulse.z } });
    const ped = id >= STATIC_PED_ID_BASE ? this.people[id - STATIC_PED_ID_BASE] : undefined;
    const moto = ped ? undefined : this.list.find((a) => a.id === id && a.kind === 'moto');
    const target = ped ?? moto;
    if (!target) return;
    target.push.x += impulse.x;
    target.push.z += impulse.z;
    if (ped) ped.startled = 1;
  }

  /** apply shoves (critically damped slide back to rest) */
  update(dt: number): void {
    const k = Math.exp(-5 * dt);
    for (const a of this.list) {
      if (Math.abs(a.push.x) + Math.abs(a.push.z) < 1e-3) continue;
      a.pos.x += a.push.x * dt;
      a.pos.z += a.push.z * dt;
      a.push.x *= k;
      a.push.z *= k;
      agentHull(a.spec, a.pos.x, a.pos.z, a.heading, a);
      this.dirty = true;
    }
    for (const p of this.people) {
      p.pos.x += p.push.x * dt;
      p.pos.z += p.push.z * dt;
      p.push.x *= k;
      p.push.z *= k;
      p.startled = Math.max(0, p.startled - dt * 0.8);
    }
  }

  private rebuild(): void {
    this.hash.clear();
    for (const a of this.list) this.hash.insertCircle(a, a.pos.x, a.pos.z, Math.hypot(a.spec.length, a.spec.width) / 2);
    this.dirty = false;
  }
}
