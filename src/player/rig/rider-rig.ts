import { Group, type Object3D, Vector3 } from 'three';
import { damp, smoothstep } from '../../core/math2d';
import type { Loadout, PassengerProfile, PlayerState } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import { findNode } from '../../engine/assets/material-tools';
import type { QualitySettings } from '../../engine/quality';
import { CURB_HEIGHT, isRaised } from '../../physics/curb-detector';
import { BikeAnimator } from './bike-animator';
import { BikeLights } from './bike-lights';
import { FallAnimator } from './fall-animator';
import { colorHex } from '../../core/config/catalog';
import { PovArms } from '../cockpit/pov-arms';
import { FirstPersonMask } from './first-person';
import { type BodyJoints, bodyJoints } from './joints';
import { type Dressing, dressRider, dropGear, emptyDressing, paintBike, povHidden, RIDER_LOOK, seatLift, undress } from './loadout';
import { mergeParts, releasePart } from './merge-parts';
import { PassengerSlot } from './passenger-slot';
import { RiderAnimator, type SeatPoints, seatPoints } from './rider-animator';

export type RigPose = 'ride' | 'idle_feet_down' | 'board' | 'fallen';

export interface RigFrame {
  /** steering input −1..1 (bars + head) */
  steer?: number;
  /** brake input 0..1 (brake light) */
  brake?: number;
  /** Environment.lampsOn 0..1 (head/tail lamp emission, headlamp glow) */
  lamps?: number;
  /** Environment.night 0..1 (headlight pool on the road) */
  night?: number;
  /** ground height under the bike; default: curb height on raised surfaces */
  groundY?: number;
}

const PITCH_PIVOT = new Vector3(0, 0.42, -0.1);
const seatW = new Vector3();

/**
 * The player's bike + rider (+ passenger) as one THREE group: loadout (paint, helmet, outfit, gear), procedural
 * riding animation (steer, wheels, suspension, lean with extra rider lean, IK hands/feet, tuck, feet down, horn),
 * falls with tumble + get-up, boarding / dismount, brake & head lights. Drive it with `update(dt, state, frame)`.
 */
export class RiderRig {
  readonly root = new Group();
  pose: RigPose = 'ride';
  private readonly roll = new Group();
  private readonly pitch = new Group();
  private readonly content = new Group();
  private readonly body: Object3D;
  private readonly j: BodyJoints;
  private readonly rider: RiderAnimator;
  private readonly fall: FallAnimator;
  private readonly lights: BikeLights;
  private readonly slot: PassengerSlot;
  private readonly fp = new FirstPersonMask();
  private readonly povArms: PovArms;
  private readonly dress: Dressing = emptyDressing();
  private bikeObj!: Object3D;
  private anim!: BikeAnimator;
  private seat!: SeatPoints;
  private pillion = new Vector3(0, 0.89, -0.56);
  private bikeId = '';
  private ground = 0;
  /** recent top speed (decays): a crash stops the bike in one step, the throw uses the speed just before */
  private impact = 0;
  private wasFallen = false;

  constructor(private readonly assets: Assets, loadout: Loadout, quality: QualitySettings) {
    this.root.name = 'rider_rig';
    this.root.add(this.roll);
    this.roll.add(this.pitch);
    this.pitch.position.copy(PITCH_PIVOT);
    this.pitch.add(this.content);
    this.content.position.copy(PITCH_PIVOT).negate();
    this.body = assets.instance('char_body');
    this.body.name = 'rider';
    this.j = bodyJoints(this.body);
    this.povArms = new PovArms(this.j);
    this.content.add(this.body);
    this.rider = new RiderAnimator(this.j, this.content, this.root);
    this.fall = new FallAnimator(this.root, this.j);
    this.lights = new BikeLights(this.root, quality);
    this.slot = new PassengerSlot(assets, this.content);
    this.applyLoadout(loadout);
  }

  /** the bike instance (cockpit / mirrors read its nodes) */
  get bike(): Object3D {
    return this.bikeObj;
  }

  /** visual bar yaw (rad) */
  get barAngle(): number {
    return this.anim.barAngle;
  }

  applyLoadout(l: Loadout): void {
    const model = `bike_${l.bike}`;
    if (model !== this.bikeId) {
      dropGear(this.assets, this.dress);
      if (this.bikeObj) releasePart(this.assets, this.bikeObj);
      this.bikeObj = this.assets.instance(model);
      mergeParts(this.bikeObj);
      this.content.add(this.bikeObj);
      this.bikeId = model;
      this.anim = new BikeAnimator(this.bikeObj);
      this.seat = seatPoints(this.bikeObj, 'seat_rider');
      this.pillion = findNode(this.bikeObj, 'seat_pillion')?.position.clone() ?? this.pillion;
      this.lights.bind(this.bikeObj);
      this.povArms.bindGrips(this.bikeObj);
    }
    paintBike(this.bikeObj, l);
    dressRider(this.assets, this.body, this.bikeObj, l, this.dress);
    this.slot.setLift(seatLift(l.gear));
    // POV sleeves match what covers the forearms: the white tee under the win vest, else the outfit colour
    this.povArms.setColors(l.outfit === 'win_vest' ? RIDER_LOOK.under : colorHex(l.outfitColor), l.outfit === 'win_vest' ? '#ff8a2a' : RIDER_LOOK.under);
    if (this.fp.active) this.setFirstPerson(true);
  }

  setPassenger(profile: PassengerProfile | null, care: { poncho?: boolean; mask?: boolean } = {}): void {
    this.slot.set(profile);
    this.slot.setCare(care.poncho ?? false, care.mask ?? false);
  }

  /** raincoat / mask handed over mid-ride */
  setCare(poncho: boolean, mask: boolean): void {
    this.slot.setCare(poncho, mask);
  }

  /** passenger walks up from the curb, takes the helmet and climbs on (resolves when seated) */
  board(seconds = 2.2): Promise<void> {
    return this.slot.start('board', seconds, this.pillion.z);
  }

  /** passenger climbs off, hands the helmet back and waves from the curb */
  dismount(seconds = 1.9): Promise<void> {
    return this.slot.start('dismount', seconds, this.pillion.z);
  }

  horn(): void {
    this.rider.horn();
  }

  /** POV: hide the body down to the hands and show the chunkier cockpit sleeves + gloves on the grips instead */
  setFirstPerson(on: boolean): void {
    this.povArms.setVisible(on);
    if (!on) return this.fp.clear();
    const j = this.j;
    this.fp.apply([j.torso, j.head, ...j.arm, ...j.forearm, ...j.hand], [...povHidden(this.dress), ...this.dress.sleeves]);
  }

  setQuality(q: QualitySettings): void {
    this.lights.setQuality(q);
  }

  update(dt: number, s: PlayerState, f: RigFrame = {}): void {
    const steer = f.steer ?? 0;
    const groundTarget = f.groundY ?? (isRaised(s.surface) ? CURB_HEIGHT : 0);
    this.ground += (groundTarget - this.ground) * damp(28, dt);
    this.root.position.set(s.pos.x, this.ground, s.pos.z);
    this.root.rotation.set(0, s.heading, 0);

    this.impact = Math.max(Math.abs(s.speed), this.impact * Math.exp(-dt * 3));
    if (s.fallen && !this.wasFallen) {
      seatW.set(this.seat.seat.x, this.seat.seat.y + 0.04 + s.bounce, this.seat.seat.z);
      this.fall.begin(s, seatW, this.impact);
    }
    this.wasFallen = s.fallen;
    const falling = this.fall.update(dt, s);
    if (!falling && this.body.parent !== this.content) this.content.add(this.body);
    if (!falling) this.rider.pose(dt, s, steer, this.seat.seat);
    this.rider.reach = this.slot.riderReach;
    // a downed bike rests on its bars and peg: lift it so nothing sinks into the road
    const lift = 0.14 * smoothstep(0.7, 1.3, Math.abs(s.lean));
    this.roll.position.y = lift;
    this.roll.rotation.z = s.lean + (falling ? 0 : this.rider.standLean);
    this.pitch.rotation.x = s.pitch;
    this.content.position.y = -PITCH_PIVOT.y + s.bounce;
    this.anim.update(dt, s, steer);
    this.slot.spill(falling ? this.fall.holder : null, this.fall.fallSide);
    this.slot.pose(dt, s, this.pillion);

    this.root.updateMatrixWorld(true);
    if (!falling) this.rider.solve(this.seat);
    else if (this.fall.holdBars > 0 || this.fall.legs > 0) this.rider.solve(this.seat, this.fall.holdBars, this.fall.legs);
    this.slot.solve(this.j.hips, this.j.hand[0], this.content, this.pillion.z + 0.12);
    this.lights.update(dt, (f.brake ?? 0) > 0.1 || s.accel < -2.5, f.lamps ?? 0, f.night ?? 0, this.anim.barAngle);
    this.pose = falling ? 'fallen' : this.slot.boarding ? 'board' : s.feetDown ? 'idle_feet_down' : 'ride';
  }

  dispose(): void {
    this.povArms.dispose();
    this.slot.dispose();
    undress(this.assets, this.dress);
    this.lights.dispose();
    releasePart(this.assets, this.bikeObj);
    releasePart(this.assets, this.body);
    this.root.removeFromParent();
  }
}
