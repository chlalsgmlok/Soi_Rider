import type { Frustum } from 'three';

/** Per-frame inputs shared by the vehicle and pedestrian drawers. */
export interface DrawFrame {
  dt: number;
  /** seconds since the view started (blinkers, idle motion) */
  time: number;
  /** Environment.night (0 day … 1 night) */
  night: number;
  /** Environment.lampsOn (vehicle lamps follow street lamps: dusk, rain, night) */
  lamps: number;
  rain: number;
  camX: number;
  camY: number;
  camZ: number;
  frustum: Frustum;
  /** visual ground height at a point (CityView.groundHeight, or a surface-based fallback) */
  ground: (x: number, z: number) => number;
}

/** distance at which per-limb / wheel animation stops (m) */
export const ANIM_DIST = 70;
/** people beyond this are not drawn at all (fog + tilt-shift hide them) */
export const PEOPLE_DIST = 125;
/** drivers behind glass are only drawn close to the camera */
export const DRIVER_DIST = 55;
