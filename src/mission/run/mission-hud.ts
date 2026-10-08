import { headingOf, wrapAngle } from '../../core/math2d';
import type { HudState, MissionPhase, PassengerProfile, PromptState, RunConfig, RunStats, Vec2 } from '../../core/types';
import type { Navigator } from '../nav/navigator';

/** what the HUD builder reads from the controller */
export interface MissionHudSource {
  readonly phase: MissionPhase;
  readonly passenger: PassengerProfile;
  readonly targetPos: Vec2 | null;
  readonly nav: Navigator;
  readonly pose: { pos: Vec2; heading: number };
  readonly config: RunConfig;
  readonly stats: RunStats;
  readonly comfort: { readonly value: number };
  readonly style: { readonly combo: number };
  readonly prompt: PromptState | null;
}

/** the mission's part of HudState, reused between frames */
export type MissionHud = Pick<HudState,
  'tripNumber' | 'phase' | 'targetMeters' | 'targetBearing' | 'etaLeftSec' | 'elapsedSec' | 'comfort' | 'passenger' |
  'prompt' | 'combo' | 'minimap'>;

export function createMissionHud(): MissionHud {
  return {
    tripNumber: 1, phase: 'intro', targetMeters: 0, targetBearing: 0, etaLeftSec: 0, elapsedSec: 0, comfort: 80,
    passenger: null, prompt: null, combo: 0,
    minimap: { playerPos: { x: 0, z: 0 }, playerHeading: 0, target: null, route: [] },
  };
}

/** mini-map route refresh step: the slice is re-cut after the rider advanced this far (m) */
const SLICE_STEP = 3;

/**
 * Fills the mission fields of the HUD snapshot: target distance along the route (straight line without one),
 * bearing (+ = right; sim heading grows to the LEFT, so bearing = heading − heading-to-target), ETA left, comfort,
 * passenger, prompt, combo and the mini-map's remaining route. No allocation except when the route slice is re-cut.
 */
export class MissionHudBuilder {
  readonly state = createMissionHud();
  private slicedAt = -Infinity;
  private slicedVersion = -1;

  build(m: MissionHudSource): MissionHud {
    const st = this.state;
    const target = m.targetPos;
    const { pos, heading } = m.pose;
    const live = m.phase !== 'complete' && m.phase !== 'failed';
    const straight = target ? Math.hypot(target.x - pos.x, target.z - pos.z) : 0;
    st.tripNumber = m.config.tripNumber;
    st.phase = m.phase;
    st.targetMeters = !live || m.phase === 'boarding' ? 0 : m.nav.path ? m.nav.remaining : straight;
    st.targetBearing = target && straight > 0.5 ? wrapAngle(heading - headingOf({ x: target.x - pos.x, z: target.z - pos.z })) : 0;
    st.etaLeftSec = m.stats.etaSec - m.stats.timeSec;
    st.elapsedSec = m.stats.timeSec;
    st.comfort = m.comfort.value;
    st.passenger = m.phase === 'intro' ? null : m.passenger;
    st.prompt = m.prompt;
    st.combo = m.style.combo;
    const mm = st.minimap;
    mm.playerPos.x = pos.x;
    mm.playerPos.z = pos.z;
    mm.playerHeading = heading;
    mm.target = live ? target : null;
    const path = live ? m.nav.path : null;
    if (!path) mm.route.length = 0;
    else if (m.nav.version !== this.slicedVersion || Math.abs(m.nav.s - this.slicedAt) > SLICE_STEP) {
      this.slicedVersion = m.nav.version;
      this.slicedAt = m.nav.s;
      // a fresh array so the mini-map's change detection sees the new route
      mm.route = path.slice(m.nav.s, []);
    }
    return st;
  }
}
