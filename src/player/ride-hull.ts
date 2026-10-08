import { RIDE } from '../core/config/bikes';
import type { BikeStats, OBB, PlayerState } from '../core/types';

/** size of a mirror head hit box (lateral × longitudinal, m) */
export const MIRROR_BOX_W = 0.13;
export const MIRROR_BOX_L = 0.14;

function place(o: OBB, s: PlayerState, right: number, forward: number, hw: number, hl: number): void {
  const sn = Math.sin(s.heading);
  const cs = Math.cos(s.heading);
  o.cx = s.pos.x - cs * right + sn * forward;
  o.cz = s.pos.z + sn * right + cs * forward;
  o.hw = hw;
  o.hl = hl;
  o.angle = s.heading;
}

/**
 * Rebuild the body hull and the two mirror boxes from the pose (in place, no allocation).
 * Tucking pulls elbows/knees in and folds the mirrors (× RIDE.tuckWidthFactor); bags widen the body only.
 * A fallen bike lies on its side: a wider, mirror-less footprint.
 */
export function updateHull(s: PlayerState, stats: BikeStats, extraWidth: number): void {
  if (s.fallen) {
    place(s.obb, s, 0, 0, 0.5, stats.length / 2);
    place(s.mirrors[0], s, 0, 0, 0.02, 0.02);
    place(s.mirrors[1], s, 0, 0, 0.02, 0.02);
    s.width = 1;
    return;
  }
  const k = s.tuck ? RIDE.tuckWidthFactor : 1;
  const body = stats.width * k + Math.max(0, extraWidth);
  const span = stats.mirrorSpan * k;
  place(s.obb, s, 0, 0, body / 2, stats.length / 2);
  const lat = span / 2 - MIRROR_BOX_W / 2;
  place(s.mirrors[0], s, -lat, stats.mirrorZ, MIRROR_BOX_W / 2, MIRROR_BOX_L / 2);
  place(s.mirrors[1], s, lat, stats.mirrorZ, MIRROR_BOX_W / 2, MIRROR_BOX_L / 2);
  s.width = Math.max(span, body);
}
