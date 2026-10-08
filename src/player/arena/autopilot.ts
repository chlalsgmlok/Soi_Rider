import { angleDiff, clamp, KMH } from '../../core/math2d';
import type { BikeStats, ClearanceInfo, PlayerState } from '../../core/types';
import type { RideInput } from '../bike-physics';
import { maxSteerAt } from '../ride-steering';

/** [x, z, km/h, phase label?] */
export type Waypoint = readonly [number, number, number, string?];

export interface Scenario {
  start: { x: number; z: number; heading: number };
  path: readonly Waypoint[];
  /** phases ridden tucked */
  tuck?: readonly string[];
  /** phase at which the rider taps the horn */
  horn?: string;
}

/** Scripted rides for headless screenshots (sandbox ?autopilot=<name>). */
export const SCENARIOS: Readonly<Record<string, Scenario>> = {
  // up the lane split, through the taxi | van gap, then a leaning left turn into the soi
  squeeze: {
    start: { x: 3.3, z: -46, heading: 0 },
    // waypoints sit on the measured gap centres of each queued row (see arena-layout)
    path: [[3.3, -46, 16], [3.32, -34, 16, 'approach'], [3.34, -24.7, 14, 'rows'], [3.27, -16.5, 14],
      [3.28, -9.3, 12, 'gap-in'], [3.1, -3.4, 11, 'gap'], [3.12, 0.4, 12, 'gap-out'], [3.3, 3.4, 15, 'exit'],
      [4.6, 6.6, 18, 'turn'], [8.2, 9.4, 20, 'soi'], [16, 9.8, 20], [44, 9.8, 18, 'end']],
    horn: 'rows',
  },
  // a fast, hard left out of the soi onto the main road (lean ≈ 35–40°), then a stop with a foot down
  turn: {
    start: { x: 36, z: 10.0, heading: -Math.PI / 2 },
    path: [[36, 10.0, 26], [22, 10.0, 27], [12.8, 10.0, 26, 'turn-in'], [7.4, 10.9, 25, 'apex'], [5.1, 15.0, 25, 'turn-out'],
      [5.3, 22, 26, 'straight'], [5.3, 33, 14, 'braking'], [5.3, 37.2, 3, 'stop'], [5.3, 39.5, 0]],
  },
  // charge the curb lane and rear-end the songthaew → heavy contact, fall, get up
  fall: {
    start: { x: 5.2, z: -52, heading: 0 },
    path: [[5.2, -52, 34], [5.2, -38, 35, 'charge'], [5.05, -24, 35, 'impact']],
  },
};

/**
 * Pure-pursuit path follower producing PlayerInput-like controls: steers toward a point a speed-dependent
 * distance ahead on the polyline and holds the waypoint speeds with throttle / brake.
 */
export class Autopilot {
  phase = 'start';
  private readonly cum: number[] = [0];
  private s = 0;
  private hornDone = false;
  readonly input: RideInput & { horn: boolean } = { throttle: 0, brake: 0, steer: 0, tuck: false, horn: false };

  constructor(readonly scenario: Scenario, private readonly stats: BikeStats) {
    const p = scenario.path;
    for (let i = 1; i < p.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  }

  get done(): boolean {
    return this.s >= this.cum[this.cum.length - 1] - 0.4;
  }

  /** `clearance` (optional) lets it centre itself in tight gaps like a careful rider */
  update(st: PlayerState, clearance?: ClearanceInfo): RideInput & { horn: boolean } {
    const inp = this.input;
    inp.horn = false;
    this.track(st.pos.x, st.pos.z);
    const v = Math.max(0, st.speed);
    const look = 2.4 + 0.32 * v;
    let [tx, tz] = this.pointAt(this.s + look);
    if (clearance && clearance.left < 0.6 && clearance.right < 0.6) {
      const shift = clamp((clearance.right - clearance.left) / 2, -0.25, 0.25); // + = move right
      tx += -Math.cos(st.heading) * shift;
      tz += Math.sin(st.heading) * shift;
    }
    const alpha = angleDiff(st.heading, Math.atan2(tx - st.pos.x, tz - st.pos.z));
    const delta = Math.atan((2 * Math.sin(alpha) / look) * this.stats.wheelbase);
    inp.steer = clamp(-delta / Math.max(0.05, maxSteerAt(this.stats, v)), -1, 1);
    const want = this.done ? 0 : this.speedAt(this.s + 1.5) / KMH;
    const err = want - v;
    inp.throttle = want > 0.05 ? clamp(0.25 + err * 0.9, 0, 1) : 0;
    inp.brake = err < -0.3 || want <= 0.05 ? clamp(-err * 0.45 + (want <= 0.05 ? 0.4 : 0), 0, 1) : 0;
    inp.tuck = this.scenario.tuck?.includes(this.phase) ?? false;
    if (!this.hornDone && this.phase === this.scenario.horn) {
      this.hornDone = true;
      inp.horn = true;
    }
    return inp;
  }

  private track(x: number, z: number): void {
    const p = this.scenario.path;
    let best = Infinity;
    let bestS = this.s;
    for (let i = 1; i < p.length; i++) {
      if (this.cum[i] < this.s - 1) continue;
      const ax = p[i - 1][0];
      const az = p[i - 1][1];
      const dx = p[i][0] - ax;
      const dz = p[i][1] - az;
      const len = Math.hypot(dx, dz);
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (len * len), 0, 1);
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best) {
        best = d;
        bestS = this.cum[i - 1] + len * t;
      }
      if (this.cum[i - 1] > this.s + 12) break;
    }
    this.s = Math.max(this.s, bestS);
    for (let i = 0; i < p.length; i++) if (this.cum[i] <= this.s && p[i][3]) this.phase = p[i][3] ?? this.phase;
  }

  private seg(s: number): [number, number] {
    const c = this.cum;
    const last = c.length - 1;
    if (s >= c[last]) return [last - 1, 1];
    let i = 1;
    while (i < last && c[i] < s) i++;
    return [i - 1, (s - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1])];
  }

  private pointAt(s: number): [number, number] {
    const p = this.scenario.path;
    const [i, t] = this.seg(Math.max(0, s));
    return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t];
  }

  private speedAt(s: number): number {
    const p = this.scenario.path;
    const [i, t] = this.seg(Math.max(0, s));
    return p[i][2] + (p[i + 1][2] - p[i][2]) * t;
  }
}
