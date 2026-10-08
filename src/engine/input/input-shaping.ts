/** Pure input-shaping helpers (deadzones, response curves, digital→analog ramps). */

export interface SourceFrame {
  throttle: number;
  brake: number;
  /** −1..1, +1 = right */
  steer: number;
  tuck: boolean;
  horn: boolean;
  interact: boolean;
  camera: boolean;
  pause: boolean;
  /** any press this frame */
  any: boolean;
  /** the device produced deliberate input this frame (for last-used-device) */
  active: boolean;
}

export const emptyFrame = (): SourceFrame => ({
  throttle: 0, brake: 0, steer: 0, tuck: false, horn: false, interact: false, camera: false, pause: false,
  any: false, active: false,
});

/** scaled radial deadzone for a stick: returns [x, y] remapped so the edge of the deadzone is 0 */
export function radialDeadzone(x: number, y: number, dz: number): [number, number] {
  const m = Math.hypot(x, y);
  if (m <= dz) return [0, 0];
  const s = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [x * s, y * s];
}

/** 1-D deadzone with rescale (triggers) */
export function axisDeadzone(v: number, dz: number): number {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return (Math.sign(v) * Math.min(1, a - dz)) / (1 - dz);
}

/** finer control around the centre: |v|^exp keeping the sign */
export const curve = (v: number, exp: number): number => Math.sign(v) * Math.abs(v) ** exp;

/**
 * Move `current` toward `target` at a constant rate so a digital key reaches full lock in `rampSec`.
 * Returning to centre / reversing is faster (`releaseSec`) so counter-steer feels crisp.
 */
export function rampToward(current: number, target: number, dt: number, rampSec: number, releaseSec: number): number {
  const releasing = target === 0 || Math.sign(target) !== Math.sign(current);
  const rate = 1 / Math.max(1e-3, releasing && current !== 0 ? releaseSec : rampSec);
  const step = rate * dt;
  const d = target - current;
  return Math.abs(d) <= step ? target : current + Math.sign(d) * step;
}
