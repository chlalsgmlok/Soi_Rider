/** §10 CARE: the last metres before the drop … */
export const SMOOTH_ZONE = 15;
/** … braking gentler than this (m/s²) … */
export const SMOOTH_DECEL = 3;
/** … and stopping inside the pin's inner ring (m) */
export const INNER_RING = 2;
/** leaving this far from the drop forgets the approach (m) */
const RESET = 28;

/** Tracks the final approach to the drop-off for the "부드러운 도착" care bonus. */
export class SmoothArrival {
  private inZone = false;
  private maxDecel = 0;

  update(distToDrop: number, accel: number): void {
    if (distToDrop <= SMOOTH_ZONE) {
      this.inZone = true;
      this.maxDecel = Math.max(this.maxDecel, -accel);
    } else if (distToDrop > RESET) {
      this.inZone = false;
      this.maxDecel = 0;
    }
  }

  /** verdict once the bike has settled `stopDist` metres from the stop point */
  smooth(stopDist: number): boolean {
    return this.inZone && this.maxDecel < SMOOTH_DECEL && stopDist <= INNER_RING;
  }
}
