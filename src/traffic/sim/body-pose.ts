import type { Pose, Tracks } from './tracks';

const rear: Pose = { x: 0, z: 0, h: 0 };
const front: Pose = { x: 0, z: 0, h: 0 };

/** fraction of the half length between the axles and the body centre */
const AXLE = 0.6;

/** sample arc length s on `track`, continuing onto `prev` (s < 0) or `next` (s > length) when known */
function along(tracks: Tracks, track: number, s: number, lat: number, prev: number, next: number, out: Pose): void {
  if (s < 0 && prev >= 0) {
    tracks.sample(prev, tracks.get(prev).length + s, lat, out);
    return;
  }
  const len = tracks.get(track).length;
  if (s > len && next >= 0) {
    tracks.sample(next, s - len, lat, out);
    return;
  }
  tracks.sample(track, s, lat, out);
}

/**
 * Rigid-body pose of a vehicle whose centre is at arc length s (lateral offset lat): both axles sit on the path
 * (rear at s − a, front at s + a, continuing onto the previous / next track), the body is the chord between them.
 * Unlike "centre on the path, heading = tangent" this keeps the tail inside its lane through tight turns, and it
 * stays continuous when the centre hops from a connector to the next lane.
 */
export function bodyPose(tracks: Tracks, track: number, s: number, lat: number, halfLen: number, out: Pose, prev = -1, next = -1): Pose {
  const a = halfLen * AXLE;
  along(tracks, track, s - a, lat, prev, next, rear);
  along(tracks, track, s + a, lat, prev, next, front);
  const dx = front.x - rear.x;
  const dz = front.z - rear.z;
  out.x = (rear.x + front.x) / 2;
  out.z = (rear.z + front.z) / 2;
  out.h = dx * dx + dz * dz > 1e-8 ? Math.atan2(dx, dz) : rear.h;
  return out;
}
