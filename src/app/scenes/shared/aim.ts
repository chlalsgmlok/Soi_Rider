import type { Vector3 } from 'three';
import { clamp } from '../../../core/math2d';

/**
 * Look target for a level (no-roll) camera at `eye` so that `subject` lands at screen NDC (`ndcX`, `ndcY`) instead
 * of the centre — how a backdrop keeps its hero in the space a docked panel leaves free. Solves the camera's yaw and
 * pitch exactly; writes and returns `out` (`dist` metres ahead of the eye).
 */
export function aimAt(
  eye: Vector3, subject: Vector3, ndcX: number, ndcY: number, fovDeg: number, aspect: number, dist: number, out: Vector3,
): Vector3 {
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  // the subject's direction in camera space (−Z forward) and in the world, scaled to the same length
  const a = ndcX * tanV * aspect;
  const b = ndcY * tanV;
  const n = Math.hypot(a, b, 1);
  const dx = subject.x - eye.x;
  const dy = subject.y - eye.y;
  const dz = subject.z - eye.z;
  const k = n / Math.max(1e-9, Math.hypot(dx, dy, dz));
  // pitch θ: rotating (a, b, −1) about X must give the world height; yaw ψ then turns it onto the world heading
  const pitch = Math.asin(clamp((dy * k) / Math.hypot(1, b), -1, 1)) - Math.atan2(b, 1);
  const zc = b * Math.sin(pitch) - Math.cos(pitch);
  const yaw = Math.atan2(dx, dz) - Math.atan2(a, zc);
  const c = Math.cos(pitch);
  return out.set(eye.x - c * Math.sin(yaw) * dist, eye.y + Math.sin(pitch) * dist, eye.z - c * Math.cos(yaw) * dist);
}

/**
 * NDC x of the centre of the free space left of a right-docked panel. `panelPx` = the panel's footprint at the
 * 1280×720 design size (screens zoom with the viewport like src/ui/core/viewport-scale.ts).
 */
export function freeNdcX(width: number, height: number, panelPx: number): number {
  const zoom = clamp(Math.min(width / 1280, height / 720), 0.8, 1.5);
  const free = clamp((width - panelPx * zoom) / Math.max(1, width), 0.4, 1);
  return free - 1;
}
