import { clamp } from '../../core/math2d';
import type { AheadHit } from './corridor';
import { desiredSpeed, type DriveCtx } from './drive-ctx';
import { approachAccel, EMERGENCY_DECEL, idmAccel, stopAccel } from './idm';
import type { LampState } from './signal-plan';
import type { Vehicle } from './vehicle';

/** bumper gap NPCs never close below (m) — the kinematic safety net */
export const MIN_GAP = 0.18;
/** extra gap kept to people and the rider */
const SOFT_GAP = 0.35;
/** hardest braking used to slow for a curve ahead */
const CURVE_DECEL = -3.2;

/** Result of one longitudinal decision. */
export interface LongPlan {
  accel: number;
  /** metres the vehicle may still cover this step without touching anything */
  room: number;
  /** lamp ahead at the end of the current lane ('green' when none) */
  lamp: LampState;
  /** distance from the front to the stop point (Infinity when not approaching a junction) */
  distLine: number;
  /** held at a junction gate (waiting for a grant) */
  atGate: boolean;
}

const hit: AheadHit = { gap: Infinity, speed: 0, kind: 'none', index: -1 };

/**
 * Car-following + stop lines + junction admission for one vehicle. The IDM follows the first obstacle in the
 * corridor; red / stoppable amber and a denied junction gate add a virtual standing leader at the stop point;
 * curves ahead cap the approach speed. `stopBack` = how far before the lane end the front stops.
 */
export function planLongitudinal(v: Vehicle, self: number, ctx: DriveCtx, lat: number, halfW: number, stopBack: number, out: LongPlan): LongPlan {
  const t = ctx.tracks.get(v.track);
  const v0 = desiredSpeed(v, t, ctx);
  const look = clamp(v.speed * 3.2 + 10, 12, 65);
  ctx.scanner.scan(v, self, lat, halfW, look, hit);
  let a = idmAccel(v.speed, v0, hit.gap, v.speed - hit.speed, v.idm);
  let room = hit.gap - (hit.kind === 'vehicle' ? MIN_GAP : SOFT_GAP);
  v.leader = hit.kind;
  out.lamp = 'green';
  out.distLine = Infinity;
  out.atGate = false;
  const next = v.route[0];
  if (t.lane >= 0 && next !== undefined) {
    const conn = ctx.tracks.get(next);
    const dEnd = t.length - v.s - v.halfLen;
    a = Math.min(a, Math.max(CURVE_DECEL, approachAccel(v.speed, conn.speedLimit, dEnd)));
    const distLine = dEnd - stopBack;
    out.distLine = distLine;
    ctx.gate.refresh(v, distLine);
    if (v.grant !== next) {
      const lamp = ctx.gate.lampAhead(v);
      out.lamp = lamp;
      const mustStop = lamp === 'red' || (lamp === 'yellow' && ctx.gate.amberStops(v, distLine));
      const near = distLine < Math.max(4, v.speed * 2.6 + 3);
      const first = hit.gap > distLine - 0.3;
      const granted = !mustStop && near && first && ctx.gate.request(v, next, distLine, self);
      if (!granted && (mustStop ? distLine < look + 5 : near)) {
        const as = stopAccel(v.speed, v0, Math.max(0, distLine), v.idm);
        if (as < a) {
          a = as;
          v.leader = 'stop';
        }
        room = Math.min(room, distLine);
        out.atGate = near;
      }
    }
  }
  out.accel = clamp(a, EMERGENCY_DECEL, v.idm.a);
  out.room = room;
  return out;
}
