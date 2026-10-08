import type { CityData, RoadClass, TurnKind } from '../../core/types';
import type { Conflict } from './conflicts';
import type { LaneLists } from './lane-lists';
import type { Obstacles } from './obstacles';
import type { SignalBank } from './signals';
import type { Tracks } from './tracks';
import { sweepBlocked } from './turn-sweep';
import type { Vehicle } from './vehicle';

const CLASS_RANK: Record<RoadClass, number> = { main: 3, avenue: 2, soi: 1 };
const TURN_RANK: Record<TurnKind, number> = { straight: 3, left: 2, right: 1, uturn: 0 };
/** amber: stop if this deceleration (m/s²) suffices, else go */
const AMBER_STOP_DECEL = 3.6;

/**
 * Junction admission. A vehicle may enter a connector only with a grant: its signal shows green (or amber it
 * cannot stop for), no granted movement that crosses / merges with it is still inside the shared zone, no
 * higher-priority vehicle is about to arrive on a conflicting movement (gap acceptance — patience shrinks the gap
 * it needs), its rigid body can sweep through the turn without clipping anyone standing beside the path, and its
 * exit lane has room so it never blocks the box. Grants are handed out sequentially, so two
 * conflicting vehicles can never be admitted in the same step.
 */
export class JunctionGate {
  private readonly occupants: Vehicle[][];
  private readonly prio: Int16Array;

  constructor(
    private readonly city: CityData,
    private readonly tracks: Tracks,
    private readonly conflicts: readonly Conflict[][],
    private readonly signals: SignalBank,
    private readonly lists: LaneLists,
    private readonly obstacles: Obstacles,
  ) {
    this.occupants = city.nodes.map(() => []);
    this.prio = new Int16Array(city.connectors.length);
    for (const c of city.connectors) {
      const turn = TURN_RANK[c.turn];
      const node = city.nodes[c.node];
      const cls = CLASS_RANK[city.edges[city.lanes[c.from].edge].cls];
      this.prio[c.id] = node.signal ? (c.turn === 'left' ? 3 : turn) : cls * 10 + turn;
    }
  }

  /** where `o` is along its granted connector (negative = still approaching, > length = beyond) */
  progress(o: Vehicle, connTrack: number): number {
    const conn = this.tracks.get(connTrack);
    if (o.track === connTrack) return o.s;
    const from = this.city.connectors[conn.connector].from;
    if (o.track === from) return o.s - this.tracks.get(from).length;
    if (o.track === conn.next[0]) return conn.length + o.s;
    return Infinity;
  }

  /** lamp the vehicle faces at the end of its lane */
  lampAhead(v: Vehicle): 'green' | 'yellow' | 'red' {
    const t = this.tracks.get(v.track);
    return t.lane < 0 ? 'green' : this.signals.lamp(t.node, t.edge);
  }

  /** must stop for amber? */
  amberStops(v: Vehicle, distToLine: number): boolean {
    return distToLine > (v.speed * v.speed) / (2 * AMBER_STOP_DECEL) + 0.3;
  }

  request(v: Vehicle, connTrack: number, distToLine: number, self: number): boolean {
    if (this.blocker(v, connTrack, distToLine, self) !== null) return false;
    v.grant = connTrack;
    this.occupants[this.tracks.get(connTrack).node].push(v);
    return true;
  }

  /** why a grant would be refused right now (null = it would be granted) — also used by debug overlays */
  blocker(v: Vehicle, connTrack: number, distToLine: number, self: number): string | null {
    const conn = this.tracks.get(connTrack);
    const lamp = this.lampAhead(v);
    if (lamp === 'red' || (lamp === 'yellow' && this.amberStops(v, distToLine))) return lamp;
    if (!this.exitHasRoom(v, conn.next[0], connTrack)) return 'exit full';
    const occ = this.occupants[conn.node];
    for (const c of this.conflicts[conn.connector]) {
      for (const o of occ) {
        if (o === v || o.grant !== c.other) continue;
        // a vehicle behind me in my own lane follows me; it never blocks my way in
        if (o.track === v.track && o.s < v.s) continue;
        if (this.progress(o, c.other) - o.halfLen < c.o1 + 0.4) return `occupied by #${o.id}`;
      }
      if (this.priorityApproaching(v, conn.connector, c, distToLine)) return 'yield';
    }
    if (!v.isMoto && sweepBlocked(v, self, connTrack, this.tracks, this.obstacles)) return 'sweep';
    return null;
  }

  /**
   * Drop grants of vehicles that have cleared their connector, and grants a red / stoppable amber now forbids for
   * vehicles that have not entered the box yet (a car stuck behind a bike in the box at red must not keep the
   * junction reserved for the whole red phase).
   */
  refresh(v: Vehicle, distToLine: number): void {
    if (v.grant < 0) return;
    const p = this.progress(v, v.grant);
    const conn = this.tracks.get(v.grant);
    if (p - v.halfLen > conn.length + 0.2) {
      this.release(v);
      return;
    }
    const toBox = -(p + v.halfLen);
    if (toBox < -0.2) return;
    const lamp = this.lampAhead(v);
    const canStop = toBox > (v.speed * v.speed) / (2 * 6) + 0.2 || v.speed < 1;
    if (lamp === 'red' && canStop) this.release(v);
    else if (lamp === 'yellow' && this.amberStops(v, Math.min(distToLine, toBox))) this.release(v);
  }

  /** register an admission without checks (a vehicle that is already over the line, e.g. spawned there) */
  force(v: Vehicle, connTrack: number): void {
    this.release(v);
    v.grant = connTrack;
    this.occupants[this.tracks.get(connTrack).node].push(v);
  }

  release(v: Vehicle): void {
    if (v.grant < 0) return;
    const occ = this.occupants[this.tracks.get(v.grant).node];
    const i = occ.indexOf(v);
    if (i >= 0) occ.splice(i, 1);
    v.grant = -1;
  }

  /** vehicles currently admitted at a node (for debug overlays) */
  admitted(node: number): readonly Vehicle[] {
    return this.occupants[node];
  }

  private priorityApproaching(v: Vehicle, connId: number, c: Conflict, distToLine: number): boolean {
    const otherConn = this.tracks.get(c.other);
    const otherId = otherConn.connector;
    if (this.prio[otherId] <= this.prio[connId]) return false;
    const fromLane = this.city.connectors[otherId].from;
    const lane = this.tracks.get(fromLane);
    if (this.signals.lamp(lane.node, lane.edge) === 'red') return false;
    const patience = Math.max(0.3, 1 - v.wait / 24);
    const clear = (distToLine + c.z1 + 2 * v.halfLen) / Math.max(2.5, this.tracks.get(connId + this.tracks.laneCount).speedLimit * 0.7);
    const horizon = (clear + 1.2) * patience;
    const list = this.lists.on(fromLane);
    for (let i = list.length - 1; i >= 0 && i >= list.length - 3; i--) {
      const o = list[i];
      if (o.grant >= 0 || o.route[0] !== c.other || (fromLane === v.track && o.s <= v.s)) continue;
      if (o.speed < 1) continue;
      const eta = (lane.length - o.s - o.halfLen) / o.speed;
      if (eta < horizon) return true;
    }
    return false;
  }

  private exitHasRoom(v: Vehicle, toLane: number, connTrack: number): boolean {
    let room = this.lists.tailRoom(toLane);
    for (const o of this.occupants[this.tracks.get(connTrack).node]) {
      if (o === v || o.grant < 0 || this.tracks.get(o.grant).next[0] !== toLane) continue;
      if (o.track !== toLane) room -= o.spec.length + (o.isMoto ? 0.6 : 1.6);
    }
    return room >= (v.isMoto ? 2.4 : v.spec.length + 1.2);
  }
}
