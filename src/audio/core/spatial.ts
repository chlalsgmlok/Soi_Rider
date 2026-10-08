import type { Vec2 } from '../../core/types';
import { clamp, forwardOf, rightOf, smoothstep } from '../../core/math2d';

export interface Listener {
  pos: Vec2;
  heading: number;
}

export interface SpatialMix {
  /** −1 left .. +1 right */
  pan: number;
  /** distance gain 0..1 */
  gain: number;
  /** air absorption / head-shadow lowpass (Hz) */
  cutoff: number;
  distance: number;
}

/**
 * Stereo placement of a world point heard from the rider: inverse-distance rolloff from `refDist`, side pan,
 * high-frequency loss with distance and a slightly duller sound from behind. Pure (unit tested).
 */
export function spatialize(l: Listener, p: Vec2, refDist = 3, maxDist = 220): SpatialMix {
  const dx = p.x - l.pos.x;
  const dz = p.z - l.pos.z;
  const d = Math.hypot(dx, dz);
  const r = rightOf(l.heading);
  const f = forwardOf(l.heading);
  const side = (dx * r.x + dz * r.z) / (d + 1.2);
  const front = d > 1e-6 ? (dx * f.x + dz * f.z) / d : 1;
  const fade = 1 - smoothstep(maxDist * 0.7, maxDist, d);
  const gain = Math.min(1, refDist / Math.max(refDist, d)) ** 0.85 * fade;
  const behind = front < 0 ? 1 + 0.35 * front : 1;
  const cutoff = clamp(16000 * Math.exp(-d / 90) * behind, 900, 16000);
  return { pan: clamp(side, -1, 1) * 0.9, gain, cutoff, distance: d };
}
