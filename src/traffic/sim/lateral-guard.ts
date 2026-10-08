import type { OBB } from '../../core/types';
import { bodyPose } from './body-pose';
import type { DriveCtx } from './drive-ctx';
import { obbMayTouch, obbPenetration } from './obb-depth';
import type { Pose } from './tracks';
import type { Vehicle } from './vehicle';

const pose: Pose = { x: 0, z: 0, h: 0 };
const probe: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };
const other: OBB = { cx: 0, cz: 0, hw: 0, hl: 0, angle: 0 };
const cand: number[] = [];

/**
 * Would the vehicle's hull, moved to lateral offset `lat` on its track (lengthened by `padLen` both ways for a
 * safety headway), touch another vehicle or the rider? Every sideways move — motorbike slot changes, lane changes,
 * a car settling into its lane habit — is checked with this before it happens, so no NPC ever slides into a body.
 */
export function lateralBlocked(v: Vehicle, self: number, lat: number, ctx: DriveCtx, padLen = 0): boolean {
  bodyPose(ctx.tracks, v.track, v.s, lat, v.halfLen, pose, v.prevTrack, v.route[0] ?? -1);
  probe.cx = pose.x;
  probe.cz = pose.z;
  probe.hw = v.halfW + 0.06;
  probe.hl = v.halfLen + 0.05 + padLen;
  probe.angle = pose.h;
  const r = probe.hl + 7;
  const n = ctx.obstacles.query(pose.x - r, pose.z - r, pose.x + r, pose.z + r, cand);
  for (let k = 0; k < n; k++) {
    const i = cand[k];
    if (i === self) continue;
    const o = ctx.obstacles.items[i];
    if (o.kind === 'pedestrian') continue;
    other.cx = o.x;
    other.cz = o.z;
    other.hw = o.hw;
    other.hl = o.hl;
    other.angle = o.h;
    if (obbMayTouch(probe, other) && obbPenetration(probe, other) > 0) return true;
  }
  return false;
}
