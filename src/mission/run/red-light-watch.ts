import type { CityData, Lane, PlayerState, RoadNode, SignalView } from '../../core/types';
import { approachAxis, signalAspect } from '../../world/build/lights/signal-phase';

export type SignalLookup = (node: number) => SignalView | null;

/** riding faster than this (m/s) along a lane arms the watch for that lane's stop line */
const ARM_SPEED = 0.5;
/** the bike centre must be this far past the stop line (m) — a nose over the line while waiting is not running it */
export const CROSS_MARGIN = 0.5;
/** crossings farther than this from the lane centre line (m) happen beside the carriageway, not through the light */
export const CORRIDOR = 6;

/**
 * Red-light running (docs/GAME_DESIGN.md §6, §10): the lane the rider follows ends at a signalised junction's stop
 * line (the lane end — src/world trims lanes there); crossing it while that approach shows red reports the node.
 * Amber is allowed. The phase-group convention is src/world's `approachAxis` (shared with src/traffic).
 */
export class RedLightWatch {
  private lane = -1;
  private before = 0;

  constructor(private readonly data: CityData) {}

  /** node id when the rider just ran a red light this step, else −1 */
  update(p: Pick<PlayerState, 'pos' | 'speed' | 'laneId' | 'counterflow' | 'centerline'>, signal: SignalLookup): number {
    const against = p.counterflow || p.centerline === true; // riding against the lane, penalised or not
    if (p.laneId >= 0 && p.laneId !== this.lane && !against && p.speed > ARM_SPEED) {
      const l = this.data.lanes[p.laneId];
      if (this.endNode(l).signal) {
        this.lane = l.id;
        this.before = this.toLine(l, p.pos);
      }
    }
    if (this.lane < 0) return -1;
    const l = this.data.lanes[this.lane];
    const d = this.toLine(l, p.pos);
    const lateral = Math.abs((p.pos.x - l.end.x) * l.dir.z - (p.pos.z - l.end.z) * l.dir.x);
    const crossed = this.before > -CROSS_MARGIN && d <= -CROSS_MARGIN;
    this.before = d;
    if (crossed) {
      this.lane = -1;
      if (lateral > CORRIDOR || against) return -1;
      const node = this.endNode(l);
      const sv = signal(node.id);
      const axis = approachAxis(this.data.edges[l.edge].dir);
      return sv && signalAspect(sv.phase, axis) === 'red' ? node.id : -1;
    }
    if (d < -20 || d > l.length + 10 || lateral > CORRIDOR * 2) this.lane = -1;
    return -1;
  }

  reset(): void {
    this.lane = -1;
  }

  private endNode(l: Lane): RoadNode {
    const e = this.data.edges[l.edge];
    return this.data.nodes[l.forward ? e.b : e.a];
  }

  /** metres before the stop line along the lane (negative once past it) */
  private toLine(l: Lane, p: { x: number; z: number }): number {
    return (l.end.x - p.x) * l.dir.x + (l.end.z - p.z) * l.dir.z;
  }
}
