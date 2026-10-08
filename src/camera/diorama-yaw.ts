import { damp } from '../core/math2d';
import type { PlayerState } from '../core/types';
import { type CameraWorld, insideBuilding } from './camera-clip';
import { DIORAMA_YAW, dioramaBoom } from './framings';

/**
 * Yaw offsets the diorama boom may swing to, in order of preference: the mockup-03 diagonal first, then toward
 * the street axis, then the other side. In a narrow soi the diagonal would put the camera over the shophouse row.
 */
const CANDIDATES = [DIORAMA_YAW, -0.2, -0.1, 0, 0.12, 0.24] as const;
const SAMPLES = 10;
/** a more preferred offset must stay clear this long before the camera swings back to it (s) */
const SETTLE = 0.6;
const RATE = 2.4;

/**
 * Picks the diorama yaw offset per frame so the boom stays over open street instead of being shortened/lifted by
 * the building clip (which would turn the view top-down). Switches to a less preferred offset at once when the
 * current one gets blocked, back to a preferred one only after it has been clear for SETTLE seconds, and eases
 * between them so the camera never snaps.
 */
export class DioramaYaw {
  value: number = DIORAMA_YAW;
  private choice = 0;
  private clearFor = 0;
  private readonly scores = new Array<number>(CANDIDATES.length).fill(0);

  reset(): void {
    this.value = DIORAMA_YAW;
    this.choice = 0;
    this.clearFor = 0;
  }

  update(dt: number, world: CameraWorld | null, s: PlayerState, yaw: number, ground: number, snap: boolean): number {
    if (world) this.choose(dt, world, s, yaw, ground, snap);
    const want = world ? CANDIDATES[this.choice] : DIORAMA_YAW;
    this.value = snap ? want : this.value + (want - this.value) * damp(RATE, dt);
    return this.value;
  }

  private choose(dt: number, world: CameraWorld, s: PlayerState, yaw: number, ground: number, snap: boolean): void {
    let firstClear = -1;
    let least = 0;
    for (let i = 0; i < CANDIDATES.length; i++) {
      const score = blockedSamples(world, s, yaw + CANDIDATES[i], ground);
      this.scores[i] = score;
      if (score === 0 && firstClear < 0) firstClear = i;
      if (score < this.scores[least]) least = i;
    }
    const best = firstClear >= 0 ? firstClear : least;
    if (snap || this.scores[this.choice] > 0) {
      this.choice = best;
      this.clearFor = 0;
    } else if (best < this.choice) {
      this.clearFor += dt;
      if (this.clearFor >= SETTLE) {
        this.choice = best;
        this.clearFor = 0;
      }
    } else {
      this.clearFor = 0;
    }
  }
}

/** how many boom samples (bike pivot → diorama camera at this yaw) sit inside a building */
function blockedSamples(world: CameraWorld, s: PlayerState, yaw: number, ground: number): number {
  const { back, up } = dioramaBoom(s.speed);
  const camX = s.pos.x - Math.sin(yaw) * back;
  const camZ = s.pos.z - Math.cos(yaw) * back;
  const pivotY = ground + 1.2;
  let n = 0;
  for (let i = 2; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const x = s.pos.x + (camX - s.pos.x) * t;
    const z = s.pos.z + (camZ - s.pos.z) * t;
    const y = pivotY + (ground + up - pivotY) * t;
    if (insideBuilding(world, x, y, z)) n++;
  }
  return n;
}
