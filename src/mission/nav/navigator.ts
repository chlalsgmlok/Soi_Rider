import { INTENSITY } from '../../core/config/traffic';
import type { CityData, TrafficIntensity, Vec2 } from '../../core/types';
import { buildLaneGroups, type LaneGroups } from './lane-groups';
import { searchLanes } from './lane-search';
import { routePoints } from './route-geometry';
import { type PathProjection, RoutePath } from './route-path';
import { RerouteWatch, WRONG_WAY_DOT, WRONG_WAY_SPEED } from './reroute-watch';
import { laneOffsetOf, startPoint } from './start-lane';

export interface NavPose {
  pos: Vec2;
  heading: number;
  /** signed m/s along the heading (wrong-way detection) */
  speed?: number;
}

/** a POI satisfies this: the curbside stop point and the lane it lies in */
export interface NavTarget {
  pos: Vec2;
  lane: number;
}

/** progress window: the projection only looks this far behind / ahead of the last arc position (m) */
const BACK = 25;
const AHEAD = 70;

/**
 * gram navigation (docs/GAME_DESIGN.md §9): legal A* routes over lanes + connectors, progress along the route
 * (remaining metres), automatic re-route when the rider leaves the route (> 12 m) or rides against it for 2 s
 * (throttled), and the ETA at the intensity's reference speed.
 */
export class Navigator {
  path: RoutePath | null = null;
  target: NavTarget | null = null;
  /** arc position of the rider along the path */
  s = 0;
  /** distance from the rider to the path (m) */
  offRoute = 0;
  reroutes = 0;
  /** increments whenever `path` is replaced (views rebuild on change) */
  version = 0;
  private readonly groups: LaneGroups;
  private readonly watch = new RerouteWatch();
  private readonly proj: PathProjection = { s: 0, dist: 0, seg: 0 };
  private readonly tan: Vec2 = { x: 0, z: 1 };

  constructor(readonly data: CityData) {
    this.groups = buildLaneGroups(data);
  }

  /** remaining metres along the route */
  get remaining(): number {
    return this.path ? Math.max(0, this.path.length - this.s) : 0;
  }

  /** seconds the rider has been riding against the route */
  get wrongWaySec(): number {
    return this.watch.wrongWaySec;
  }

  /** shortest legal route from a pose to a target; does not change the navigator. Null when unreachable. */
  plan(from: NavPose, to: NavTarget): RoutePath | null {
    const start = startPoint(this.data, from.pos, from.heading);
    if (!start) return null;
    const goal = { lane: to.lane, s: laneOffsetOf(this.data, to.lane, to.pos) };
    const found = searchLanes(this.data, this.groups, start, goal);
    return found ? new RoutePath(routePoints(this.data, found, to.pos)) : null;
  }

  /** route to a new target (null clears it) from the rider's pose */
  setTarget(to: NavTarget | null, from: NavPose): RoutePath | null {
    this.target = to;
    this.watch.reset();
    if (!to) return this.adopt(null);
    return this.adopt(this.plan(from, to));
  }

  /** recompute the route to the current target now */
  reroute(from: NavPose): RoutePath | null {
    if (!this.target) return null;
    this.reroutes += 1;
    const next = this.plan(from, this.target);
    return next ? this.adopt(next) : this.path;
  }

  /** per fixed step: progress + automatic re-route. True when the path was replaced. */
  update(dt: number, pose: NavPose): boolean {
    const p = this.path;
    if (!p || !this.target) return false;
    p.project(pose.pos, this.proj, this.s - BACK, this.s + AHEAD);
    this.s = this.proj.s;
    this.offRoute = this.proj.dist;
    p.tangentAt(this.s, this.tan);
    const along = Math.sin(pose.heading) * this.tan.x + Math.cos(pose.heading) * this.tan.z;
    const wrongWay = (pose.speed ?? 0) > WRONG_WAY_SPEED && along < WRONG_WAY_DOT && this.remaining > 6;
    if (!this.watch.update(dt, this.offRoute, wrongWay)) return false;
    const before = this.path;
    this.reroute(pose);
    return this.path !== before;
  }

  /** seconds to cover the remaining route at the intensity's reference speed */
  etaSeconds(intensity: TrafficIntensity): number {
    return this.remaining / INTENSITY[intensity].etaSpeed;
  }

  private adopt(path: RoutePath | null): RoutePath | null {
    this.path = path;
    this.s = 0;
    this.offRoute = 0;
    this.version += 1;
    return path;
  }
}
