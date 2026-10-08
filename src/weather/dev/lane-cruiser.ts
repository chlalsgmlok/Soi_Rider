import { BIKES } from '../../core/config/bikes';
import { clamp, damp, G, smoothstep, wrapAngle } from '../../core/math2d';
import type { Rng } from '../../core/rng';
import type { CityQuery, Lane, PlayerState, TrafficAgentView, Vec2 } from '../../core/types';
import { createPlayerState, updateHull } from '../../player';
import type { TrafficSystem } from '../../traffic';

const STATS = BIKES.cub;
const ACCEL = 2.4;
const BRAKE = 6;
/** comfortable stopping deceleration toward obstacles / stop lines */
const STOP_DECEL = 3.6;
const near: TrafficAgentView[] = [];

interface Piece {
  pts: Vec2[];
  cum: number[];
  len: number;
  lane: Lane | null;
}

function piece(pts: Vec2[], lane: Lane | null): Piece {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, cum, len: cum[cum.length - 1], lane };
}

/**
 * Sandbox rider: a kinematic motorbike that rides the lane graph (curb-lane edge, where the puddles are), turns
 * through connectors, queues behind NPCs and pedestrians and stops for red lights. Produces a full PlayerState for
 * the rider rig, camera rig, traffic and the weather FX — not the game's bike physics.
 */
export class LaneCruiser {
  readonly state: PlayerState = createPlayerState(STATS);
  /** target speed while riding (m/s) */
  cruise = 7.5;
  riding = true;
  private cur: Piece;
  private s = 0;
  private lastConnector: { to: number } | null = null;

  constructor(private readonly city: CityQuery, private readonly traffic: TrafficSystem, private readonly rng: Rng, lane: Lane, s: number) {
    this.cur = this.lanePiece(lane);
    this.place(lane, s);
  }

  /** jump onto a lane `s` metres from its start (standing still) */
  place(lane: Lane, s: number): void {
    this.cur = this.lanePiece(lane);
    this.s = clamp(s, 0, this.cur.len);
    this.state.speed = 0;
    this.pose(0, true);
  }

  update(dt: number): void {
    const st = this.state;
    const allowed = Math.min(this.riding ? this.cruise : 0, this.obstacleLimit(), this.signalLimit());
    const v0 = st.speed;
    st.speed = v0 + clamp(allowed - v0, -BRAKE * dt, ACCEL * dt);
    st.accel = dt > 0 ? (st.speed - v0) / dt : 0;
    this.s += st.speed * dt;
    while (this.s > this.cur.len) {
      this.s -= this.cur.len;
      const next = this.nextPiece();
      if (!next) {
        this.s = this.cur.len;
        st.speed = 0;
        break;
      }
      this.cur = next;
    }
    this.pose(dt, false);
  }

  private pose(dt: number, snap: boolean): void {
    const st = this.state;
    const { pts, cum } = this.cur;
    let i = 1;
    while (i < pts.length - 1 && cum[i] < this.s) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const t = clamp((this.s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1);
    st.pos.x = a.x + (b.x - a.x) * t;
    st.pos.z = a.z + (b.z - a.z) * t;
    const target = Math.atan2(b.x - a.x, b.z - a.z);
    const prev = st.heading;
    st.heading = snap ? target : wrapAngle(prev + wrapAngle(target - prev) * damp(9, dt));
    st.yawRate = dt > 0 ? wrapAngle(st.heading - prev) / dt : 0;
    const v = Math.max(0.5, st.speed);
    st.steer = Math.atan((-st.yawRate * STATS.wheelbase) / v);
    st.lean += (clamp(Math.atan((-st.speed * st.yawRate) / G), -0.6, 0.6) - st.lean) * (snap ? 1 : damp(6, dt));
    st.feetDown = st.speed < 2;
    st.surface = this.city.surfaceAt(st.pos.x, st.pos.z);
    st.laneId = this.cur.lane?.id ?? -1;
    updateHull(st, STATS, 0);
  }

  /** the curb-lane edge (puddles, gutters), easing back to the centre where connectors attach */
  private lanePiece(lane: Lane): Piece {
    const lat = lane.width / 2 - 0.62;
    const pts: Vec2[] = [];
    const n = Math.max(2, Math.ceil(lane.length / 2));
    for (let k = 0; k <= n; k++) {
      const s = (k / n) * lane.length;
      const l = lat * smoothstep(0, 7, s) * smoothstep(0, 7, lane.length - s);
      pts.push({ x: lane.start.x + lane.dir.x * s + lane.dir.z * l, z: lane.start.z + lane.dir.z * s - lane.dir.x * l });
    }
    return piece(pts, lane);
  }

  /** at a lane end take a connector (mostly straight on), after a connector its lane */
  private nextPiece(): Piece | null {
    const lane = this.cur.lane;
    if (!lane) {
      const c = this.lastConnector;
      return c ? this.lanePiece(this.city.lane(c.to)) : null;
    }
    const outs = lane.out.map((id) => this.city.connector(id)).filter((c) => c.turn !== 'uturn');
    if (outs.length === 0) return null;
    const c = this.rng.weighted(outs, (o) => (o.turn === 'straight' ? 4 : o.turn === 'left' ? 1.5 : 1));
    this.lastConnector = c;
    return piece(c.points.map((p) => ({ x: p.x, z: p.z })), null);
  }

  /** queue behind whatever is in the path */
  private obstacleLimit(): number {
    const st = this.state;
    const fx = Math.sin(st.heading);
    const fz = Math.cos(st.heading);
    const n = this.traffic.near({ x: st.pos.x + fx * 8, z: st.pos.z + fz * 8 }, 12, near);
    let gap = Infinity;
    for (let i = 0; i < n; i++) {
      const a = near[i];
      const rx = a.pos.x - st.pos.x;
      const rz = a.pos.z - st.pos.z;
      const ahead = rx * fx + rz * fz;
      const lat = -rx * fz + rz * fx;
      const d = a.heading - st.heading;
      const across = Math.abs(a.obb.hw * Math.cos(d)) + Math.abs(a.obb.hl * Math.sin(d));
      const along = Math.abs(a.obb.hl * Math.cos(d)) + Math.abs(a.obb.hw * Math.sin(d));
      if (ahead > 0.3 && Math.abs(lat) < across + 0.5) gap = Math.min(gap, ahead - along - 1.1);
    }
    for (const p of this.traffic.pedestrians()) {
      const rx = p.pos.x - st.pos.x;
      const rz = p.pos.z - st.pos.z;
      const ahead = rx * fx + rz * fz;
      if (ahead > 0.3 && ahead < 14 && Math.abs(-rx * fz + rz * fx) < p.radius + 0.6) gap = Math.min(gap, ahead - 1.3);
    }
    return Math.sqrt(2 * STOP_DECEL * Math.max(0, gap - 0.8));
  }

  /** stop at the line on red (keep going on a late yellow) */
  private signalLimit(): number {
    const lane = this.cur.lane;
    if (!lane) return Infinity;
    const e = this.city.edge(lane.edge);
    const node = lane.forward ? e.b : e.a;
    if (!this.city.node(node).signal) return Infinity;
    const lamp = this.traffic.lamp(node, e.id);
    const d = this.cur.len - this.s - 1.2;
    if (lamp === 'green' || d < -0.5 || (lamp === 'yellow' && d < 4)) return Infinity;
    return Math.sqrt(2 * STOP_DECEL * Math.max(0, d));
  }
}
