import { Surface, type CityQuery, type PlayerState, type TrafficAgentView, type TrafficQuery, type Vec2 } from '../../core/types';
import { obstacleSpeed } from './bot-limits';

/** blocked this long at a standstill → filter past on one side (s) */
const STUCK_SEC = 3.5;
const FILTER_SEC = 6;
/** give up filtering after this long and merge back regardless (s) */
const FILTER_MAX = 25;
/** sideways offset of the followed line while filtering (m) */
export const FILTER_SHIFT = 1.7;
/** the original line counts as clear again above this corridor speed (m/s) */
const PATH_CLEAR = 4;
/** pushing against something this long → walk back for BACK_SEC (s) */
const WEDGED_SEC = 2;
const BACK_SEC = 1.1;

export interface FilterInput {
  dt: number;
  speed: number;
  /** held up by traffic (not by a signal) */
  blocked: boolean;
  /** wants to go but is not moving (pushing against something) */
  wedged: boolean;
  /** unit route tangent at the bike */
  tangent: Vec2;
}

/**
 * The bot's way out of queues: stuck for a few seconds → offset the followed line sideways (the side that stays on
 * the carriageway and is clearer, right on a tie) until the original line ahead is clear; pushing against something
 * → walk the bike back a step and choose again.
 */
export class BotFilter {
  /** current sideways offset of the followed line (m, + = right) */
  shift = 0;
  /** seconds left of walking back */
  backFor = 0;
  private stuck = 0;
  private filter = 0;
  private total = 0;
  private wedgedFor = 0;

  constructor(private readonly city: CityQuery, private readonly scratch: TrafficAgentView[]) {}

  update(i: FilterInput, s: PlayerState, traffic: TrafficQuery | null): void {
    this.wedgedFor = i.wedged ? this.wedgedFor + i.dt : 0;
    if (this.wedgedFor > WEDGED_SEC) {
      // walk back a step, then pick a side afresh once stuck again
      this.wedgedFor = 0;
      this.backFor = BACK_SEC;
      this.filter = 0;
      this.total = 0;
      this.shift = 0;
      return;
    }
    if (this.filter > 0) {
      this.filter -= i.dt;
      this.total += i.dt;
      if (this.filter > 0) return;
      const clear = !traffic || obstacleSpeed(s, i.tangent.x, i.tangent.z, traffic, this.scratch, -this.shift) > PATH_CLEAR;
      if (clear || this.total > FILTER_MAX) {
        this.shift = 0;
        this.total = 0;
      } else this.filter = 0.5;
      return;
    }
    this.stuck = (i.blocked || i.wedged) && i.speed < 0.5 ? this.stuck + i.dt : Math.max(0, this.stuck - i.dt * 0.5);
    if (this.stuck < STUCK_SEC || !traffic) return;
    this.stuck = 0;
    const side = this.pickSide(s, i.tangent, traffic);
    if (side === 0) return;
    this.shift = FILTER_SHIFT * side;
    this.filter = FILTER_SEC;
  }

  private pickSide(s: PlayerState, t: Vec2, traffic: TrafficQuery): number {
    let best = 0;
    let bestScore = -Infinity;
    for (const side of [1, -1]) {
      const off = FILTER_SHIFT * side;
      // right of the path = (−t.z, t.x)
      const k = this.city.surfaceAt(s.pos.x + t.x * 5 - t.z * off, s.pos.z + t.z * 5 + t.x * off);
      if (k !== Surface.Road && k !== Surface.Intersection && k !== Surface.Crosswalk) continue;
      const score = Math.min(12, obstacleSpeed(s, t.x, t.z, traffic, this.scratch, off)) + (side > 0 ? 0.5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = side;
      }
    }
    return best;
  }
}
