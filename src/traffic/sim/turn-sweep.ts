import type { OBB } from '../../core/types';
import { bodyPose } from './body-pose';
import { obbMayTouch, obbPenetration } from './obb-depth';
import type { Obstacles } from './obstacles';
import type { Pose, Tracks } from './tracks';
import type { Vehicle } from './vehicle';

const STEP = 1;
/** only standing / creeping bodies are checked — moving ones are the corridor's and the conflict table's job */
const SLOW = 1.5;
const pose: Pose = { x: 0, z: 0, h: 0 };
const probe: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };
const other: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };
const cand: number[] = [];

/**
 * Would the rigid hull, driven through connector `conn` (and half a body into the next lane), clip a vehicle or
 * the rider standing next to the path — e.g. a long bus whose front overhang swings over the oncoming lane while
 * turning into a narrow soi, where another car waits at its stop line? Checked once when asking for a grant.
 */
export function sweepBlocked(v: Vehicle, self: number, conn: number, tracks: Tracks, obstacles: Obstacles): boolean {
  const t = tracks.get(conn);
  const end = t.length + v.halfLen;
  for (let s = 0; s <= end; s += STEP) {
    bodyPose(tracks, conn, s, v.lat * 0.5, v.halfLen, pose, v.track, t.next[0]);
    probe.cx = pose.x;
    probe.cz = pose.z;
    probe.hw = v.halfW + 0.08;
    probe.hl = v.halfLen + 0.1;
    probe.angle = pose.h;
    const r = probe.hl + 7;
    const n = obstacles.query(pose.x - r, pose.z - r, pose.x + r, pose.z + r, cand);
    for (let k = 0; k < n; k++) {
      const i = cand[k];
      if (i === self) continue;
      const o = obstacles.items[i];
      if (o.kind === 'pedestrian' || Math.abs(o.speed) > SLOW) continue;
      other.cx = o.x;
      other.cz = o.z;
      other.hw = o.hw;
      other.hl = o.hl;
      other.angle = o.h;
      if (obbMayTouch(probe, other) && obbPenetration(probe, other) > 0) return true;
    }
  }
  return false;
}
