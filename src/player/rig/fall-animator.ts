import { Group, type Object3D, Vector3 } from 'three';
import { RIDE } from '../../core/config/bikes';
import type { PlayerState } from '../../core/types';
import { fallSide, GETUP_TIME } from '../fall-motion';
import { applyPose, type BodyJoints, blankPose, mixPose, POSES } from './joints';
import { easeOut, smooth, span, track } from './keyframes';

const THROW = 0.3;
const TUMBLE_END = 1.15;
/** pelvis height when lying on the road */
const LYING_Y = 0.15;
/** where the rider lands, sideways from the bike (m) — clear of the downed bike, on its high side */
const LAND_X = 1.05;

const from = new Vector3();
const p = new Vector3();

/**
 * The rider's part of a fall: thrown clear to the bike's high side (more and further the faster the crash),
 * log-rolls along the road, lies sprawled, then stands up at the bars (`holdBars` → the rig IKs the hands onto
 * the grips to lift the bike) and swings back on (`legs` → feet back to the pegs) during the last GETUP_TIME
 * seconds. While active the body is re-parented from the leaning bike frame to a ground-level holder.
 */
export class FallAnimator {
  readonly holder = new Group();
  /** 0..1 hands on the grips (lifting the bike, then riding off) */
  holdBars = 0;
  /** 0..1 feet back on the pegs */
  legs = 0;
  private active = false;
  private elapsed = 0;
  private side = 1;
  private k = 1;
  /** 1 = the bike kept sliding (thrown along the road), 0 = it stopped dead against something (thrown aside) */
  private ahead = 1;
  private slide = 0;
  private rollEnd = 0;
  private readonly seatPos = new Vector3();
  private readonly mixed = blankPose();

  constructor(ground: Object3D, private readonly j: BodyJoints) {
    this.holder.name = 'rider_fall';
    ground.add(this.holder);
  }

  get running(): boolean {
    return this.active;
  }

  /** +1 = the bike went down to its right */
  get fallSide(): number {
    return this.side;
  }

  /** take the body off the bike; `seat` = hips in the ground frame, `impactSpeed` = speed just before the crash */
  begin(s: PlayerState, seat: Vector3, impactSpeed: number): void {
    this.active = true;
    this.elapsed = 0;
    this.slide = 0;
    this.holdBars = 0;
    this.legs = 0;
    this.side = fallSide(s);
    this.k = Math.min(1, impactSpeed / 9 + 0.2);
    this.ahead = Math.min(1, Math.abs(s.speed) / Math.max(0.5, impactSpeed));
    const halfRolls = Math.max(1, Math.round(this.k * 3));
    // rolling toward +X (the high side of a bike falling right) is a negative spin about Z
    this.rollEnd = -this.side * (0.9 + halfRolls * Math.PI);
    this.seatPos.copy(seat);
    this.j.root.position.set(0, 0, 0);
    this.j.root.rotation.set(0, 0, 0);
    this.holder.add(this.j.root);
  }

  /**
   * Returns false once the rider is back in the saddle (the caller re-parents the body). The timeline runs on the
   * SIMULATION's fall clock (PlayerState.fallTimer), so slow-motion and dropped frames keep rider and bike in step.
   */
  update(dt: number, s: PlayerState): boolean {
    if (!this.active) return false;
    this.elapsed = s.fallen ? RIDE.fallDuration - s.fallTimer : RIDE.fallDuration;
    this.slide += Math.abs(s.speed) * dt;
    const e = this.elapsed;
    const getup = (e - (RIDE.fallDuration - GETUP_TIME)) / GETUP_TIME;
    const j = this.j;
    const sx = this.side; // a bike falling right (−X) throws the rider to its left (+X)
    const back = this.slide * 0.45;
    // a dead stop (rear-ending a car) throws the rider aside, a slide carries them along the road
    const fly = 0.6 * this.k * this.ahead;
    const roll = 1.0 * this.k * this.ahead;
    const wide = 0.55 * this.k * (1 - this.ahead);

    if (getup < 0) {
      const thrown = easeOut(e / THROW);
      const tumble = easeOut((e - THROW) / (TUMBLE_END - THROW));
      from.set(sx * (0.35 + (LAND_X + wide - 0.35) * thrown + 0.25 * this.k * tumble),
        track([[0, this.seatPos.y], [THROW * 0.5, this.seatPos.y + 0.25 * this.k], [THROW, 0.3], [TUMBLE_END, LYING_Y]], e),
        this.seatPos.z + fly * thrown + roll * tumble - back);
      j.hips.position.copy(from);
      const spin = track([[0, 0], [THROW, -sx * 0.9], [TUMBLE_END, this.rollEnd]], e);
      j.hips.rotation.set((Math.PI / 2) * smooth(e / 0.45), 0, spin, 'ZXY');
      applyPose(j, mixPose(POSES.ride, POSES.sprawl, smooth(e / 0.25), this.mixed));
      // limbs flail during the tumble
      const flail = Math.max(0, 1 - e / TUMBLE_END) * Math.sin(e * 22);
      j.arm[0].rotation.x += flail * 0.6;
      j.arm[1].rotation.x -= flail * 0.6;
      this.holdBars = 0;
      this.legs = 0;
      return true;
    }
    // stand up beside the bars on the high side, lift the bike, swing back onto the seat
    const rise = span(getup, 0, 0.5);
    const hop = span(getup, 0.55, 1);
    const landX = sx * (LAND_X + wide + 0.25 * this.k);
    const landZ = this.seatPos.z + fly + roll - back;
    p.set(landX + (sx * 0.62 - landX) * rise, LYING_Y + (j.hipsRest.y - LYING_Y) * rise, landZ + (this.seatPos.z + 0.3 - landZ) * rise);
    from.set(0, this.seatPos.y, this.seatPos.z);
    p.lerp(from, hop);
    if (hop > 0) p.y += Math.sin(hop * Math.PI) * 0.14;
    j.hips.position.copy(p);
    // unwind the roll the short way (it ended a whole number of turns past its resting angle)
    const rest = this.rollEnd - Math.PI * 2 * Math.round(this.rollEnd / (Math.PI * 2));
    j.hips.rotation.set((Math.PI / 2) * (1 - rise), 0, rest * (1 - rise), 'ZXY');
    const standing = mixPose(POSES.sprawl, POSES.stand, rise, this.mixed);
    applyPose(j, mixPose(standing, POSES.ride, hop, this.mixed));
    this.holdBars = span(getup, 0.3, 0.55);
    this.legs = hop;
    if (s.fallen) return true;
    this.active = false;
    this.holdBars = 0;
    this.legs = 0;
    j.hips.rotation.set(0, 0, 0, 'XYZ');
    return false;
  }
}
