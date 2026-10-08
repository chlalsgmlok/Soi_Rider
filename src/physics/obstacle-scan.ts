import type {
  Circle, OBB, PedestrianView, StaticCollider, TrafficAgentView, TrafficQuery, Vec2, VehicleKind,
} from '../core/types';
import { type HeightProfile, PEDESTRIAN_HEIGHT, STATIC_HEIGHTS, VEHICLE_HEIGHTS } from './body-heights';
import type { CollisionWorld } from './collision-types';
import { MIRROR_HALF_H } from './collision-types';

export type PartSource = 'agent' | 'static' | 'ped';

/** One solid piece of an obstacle at a known height range (a car body, one of its mirrors, a pole, a person). */
export interface ObstaclePart {
  /** obstacle identity, unique across sources: agent id, 1e6 + static id, 2e6 + pedestrian id */
  key: number;
  id: number;
  source: PartSource;
  role: 'body' | 'mirror';
  obb: OBB | null;
  circle: Circle | null;
  y0: number;
  y1: number;
  /** vehicles only (belt line / tumblehome) */
  profile: HeightProfile | null;
  vehicle: VehicleKind | null;
  /** label stem for reports ("taxi", "pole", "pedestrian") */
  tag: string;
  vx: number;
  vz: number;
  speed: number;
  heading: number;
  queued: boolean;
  /** pooled circle storage for pedestrians */
  readonly own: Circle;
}

/** TrafficQuery.near matches agent CENTRES: widen the search by the longest half-length (a bus) */
export const MAX_AGENT_HALF_LENGTH = 6;

export const STATIC_KEY = 1_000_000;
export const PED_KEY = 2_000_000;

const blank = (): ObstaclePart => ({
  key: 0, id: 0, source: 'static', role: 'body', obb: null, circle: null, y0: 0, y1: 0, profile: null, vehicle: null,
  tag: '', vx: 0, vz: 0, speed: 0, heading: 0, queued: false, own: { cx: 0, cz: 0, r: 0 },
});

/**
 * Collects the obstacle parts around a point from the city's static colliders and the traffic's agents and
 * pedestrians. Parts are pooled; the returned array is valid until the next `gather`.
 */
export class ObstacleScan {
  readonly parts: ObstaclePart[] = [];
  private readonly pool: ObstaclePart[] = [];
  private readonly statics: StaticCollider[] = [];
  private readonly agents: TrafficAgentView[] = [];

  gather(p: Vec2, radius: number, city: CollisionWorld | null, traffic: TrafficQuery | null): ObstaclePart[] {
    for (const part of this.parts) this.pool.push(part);
    this.parts.length = 0;
    if (city) {
      city.staticNear(p, radius, this.statics);
      for (const c of this.statics) this.addStatic(c);
    }
    if (traffic) {
      traffic.near(p, radius + MAX_AGENT_HALF_LENGTH, this.agents);
      for (const a of this.agents) {
        const reach = radius + Math.hypot(a.spec.length, a.spec.mirrorSpan) / 2;
        if ((a.pos.x - p.x) ** 2 + (a.pos.z - p.z) ** 2 <= reach * reach) this.addAgent(a);
      }
      const r2 = radius * radius;
      for (const ped of traffic.pedestrians()) {
        if ((ped.pos.x - p.x) ** 2 + (ped.pos.z - p.z) ** 2 <= r2) this.addPed(ped);
      }
    }
    return this.parts;
  }

  private next(): ObstaclePart {
    const part = this.pool.pop() ?? blank();
    this.parts.push(part);
    part.obb = null;
    part.circle = null;
    part.profile = null;
    part.vehicle = null;
    part.vx = 0;
    part.vz = 0;
    part.speed = 0;
    part.heading = 0;
    part.queued = false;
    return part;
  }

  private addStatic(c: StaticCollider): void {
    const part = this.next();
    part.key = STATIC_KEY + c.id;
    part.id = c.id;
    part.source = 'static';
    part.role = 'body';
    part.obb = c.obb ?? null;
    part.circle = c.circle ?? null;
    part.y0 = 0;
    part.y1 = STATIC_HEIGHTS[c.tag];
    part.tag = c.tag;
  }

  private addAgent(a: TrafficAgentView): void {
    const prof = VEHICLE_HEIGHTS[a.kind];
    const vx = Math.sin(a.heading) * a.speed;
    const vz = Math.cos(a.heading) * a.speed;
    const fill = (part: ObstaclePart): void => {
      part.key = a.id;
      part.id = a.id;
      part.source = 'agent';
      part.profile = prof;
      part.vehicle = a.kind;
      part.tag = a.kind;
      part.vx = vx;
      part.vz = vz;
      part.speed = a.speed;
      part.heading = a.heading;
      part.queued = a.queued;
    };
    const body = this.next();
    fill(body);
    body.role = 'body';
    body.obb = a.obb;
    body.y0 = 0;
    body.y1 = prof.height;
    for (const m of a.mirrors) {
      const part = this.next();
      fill(part);
      part.role = 'mirror';
      part.obb = m;
      part.y0 = a.spec.mirrorY - MIRROR_HALF_H;
      part.y1 = a.spec.mirrorY + MIRROR_HALF_H;
    }
  }

  private addPed(ped: PedestrianView): void {
    const part = this.next();
    part.key = PED_KEY + ped.id;
    part.id = ped.id;
    part.source = 'ped';
    part.role = 'body';
    part.own.cx = ped.pos.x;
    part.own.cz = ped.pos.z;
    part.own.r = ped.radius;
    part.circle = part.own;
    part.y0 = 0;
    part.y1 = PEDESTRIAN_HEIGHT;
    part.tag = 'pedestrian';
    part.vx = Math.sin(ped.heading) * ped.speed;
    part.vz = Math.cos(ped.heading) * ped.speed;
    part.speed = ped.speed;
    part.heading = ped.heading;
  }
}
