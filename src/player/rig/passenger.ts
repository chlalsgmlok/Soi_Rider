import { type Mesh, type Object3D, Quaternion, Vector3 } from 'three';
import { clamp, damp } from '../../core/math2d';
import type { PassengerProfile, PlayerState } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import { isMesh } from '../../engine/assets/material-guards';
import { findNode, setColor } from '../../engine/assets/material-tools';
import { applyPose, type BodyJoints, bodyJoints, POSES } from './joints';
import { solveTwoBone } from './limb-ik';
import { mergeParts, releasePart } from './merge-parts';

const tv = new Vector3();
const fk = new Vector3();
const pole = new Vector3();
const q = new Quaternion();

/** the spare helmet a win rider hands to every passenger */
export const SPARE_HELMET = { asset: 'helmet_half', color: '#f3eee2' } as const;
const PONCHO_COLOR = '#9fd8ef';

/**
 * The pillion passenger built from a PassengerProfile look: body colours, hair, the spare helmet, an optional rain
 * poncho (glTF morph `seated` follows the sitting weight) and a smog mask. Seated pose holds the rider's waist
 * and sways a beat behind the bike (inertia under braking and leaning).
 */
export class PassengerRig {
  readonly body: Object3D;
  readonly j: BodyJoints;
  readonly helmet: Object3D;
  private readonly parts: Object3D[] = [];
  private readonly poncho: Object3D;
  private readonly mask: Object3D;
  private ponchoMesh: Mesh | null = null;
  private swayRoll = 0;
  private swayPitch = 0;
  private time = 0;

  constructor(private readonly assets: Assets, readonly profile: PassengerProfile) {
    this.body = assets.instance('char_body');
    this.body.name = 'passenger';
    this.j = bodyJoints(this.body);
    const { look } = profile;
    setColor(this.body, 'Skin', look.skin);
    setColor(this.body, 'Hands', look.skin);
    setColor(this.body, 'Shirt', look.shirt);
    setColor(this.body, 'Pants', look.pants);
    setColor(this.body, 'Hair', look.hairColor);
    const head = findNode(this.body, 'head') ?? this.body;
    const torso = findNode(this.body, 'torso') ?? this.body;
    const hair = this.add(head, look.hair);
    setColor(hair, 'Hair', look.hairColor);
    setColor(hair, 'Hat', look.shirt);
    this.helmet = this.add(head, SPARE_HELMET.asset);
    setColor(this.helmet, 'Helmet_Paint', SPARE_HELMET.color);
    this.poncho = this.add(torso, 'outfit_poncho');
    setColor(this.poncho, 'Poncho', PONCHO_COLOR);
    this.poncho.traverse((o) => {
      if (isMesh(o) && o.morphTargetDictionary?.seated !== undefined) this.ponchoMesh = o;
    });
    this.mask = this.add(head, 'acc_mask');
    this.setCare(false, false);
    mergeParts(this.body);
  }

  private add(parent: Object3D, asset: string): Object3D {
    const o = this.assets.instance(asset);
    parent.add(o);
    this.parts.push(o);
    return o;
  }

  setCare(poncho: boolean, mask: boolean): void {
    this.poncho.visible = poncho;
    this.mask.visible = mask;
  }

  /** 0 = standing … 1 = seated (drives the poncho drape morph) */
  setSeated(w: number): void {
    const m = this.ponchoMesh;
    const i = m?.morphTargetDictionary?.seated;
    if (m?.morphTargetInfluences && i !== undefined) m.morphTargetInfluences[i] = clamp(w, 0, 1);
  }

  /** seated pillion pose on `seat` (bike frame); call before the world-matrix update */
  poseSeated(dt: number, s: PlayerState, seat: Vector3): void {
    const j = this.j;
    applyPose(j, POSES.pillion);
    // inertia: the passenger lags the bike's lean and lurches under braking / throttle
    this.swayRoll += (-s.lean * 0.12 - this.swayRoll) * damp(4, dt);
    this.swayPitch += (clamp(-s.accel * 0.025, -0.08, 0.14) - this.swayPitch) * damp(6, dt);
    this.body.position.set(seat.x, seat.y + 0.05 - j.hipsRest.y, seat.z);
    this.body.rotation.set(0, 0, 0);
    j.hips.position.copy(j.hipsRest);
    j.hips.rotation.set(0, 0, this.swayRoll);
    j.torso.rotation.x += this.swayPitch;
    this.time += dt;
    j.head.rotation.set(-0.05 - this.swayPitch * 0.5, Math.sin(this.time * 0.4) * 0.25, -s.lean * 0.3);
    this.setSeated(1);
  }

  /** sitting on the road after a spill, leaning back on the hands, looking at the bike (+side = bike fell right) */
  poseOnRoad(x: number, z: number, side: number): void {
    const j = this.j;
    applyPose(j, POSES.stand);
    this.body.position.set(x, 0.16 - j.hipsRest.y, z);
    this.body.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    j.hips.position.copy(j.hipsRest);
    j.hips.rotation.set(0, 0, 0);
    j.torso.rotation.set(-0.35, 0, 0);
    j.head.rotation.set(0.25, 0.3, 0);
    for (let i = 0; i < 2; i++) {
      const m = i === 0 ? 1 : -1;
      j.thigh[i].rotation.set(-1.5, 0, 0.15 * m);
      j.shin[i].rotation.set(0.35 + 0.3 * i, 0, 0);
      j.arm[i].rotation.set(0.75, 0, 0.3 * m);
      j.forearm[i].rotation.set(-0.25, 0, 0);
    }
    this.setSeated(0.6);
  }

  /**
   * Hands to the rider's waist and feet to the pillion pegs (world matrices current). `weight` blends the targets
   * from where the current pose put the hands/feet (0) to the holds (1).
   */
  holdRider(riderHips: Object3D, frame: Object3D, pegZ: number, weight = 1): void {
    if (weight <= 0.01) return;
    const j = this.j;
    frame.getWorldQuaternion(q);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      tv.set(side * 0.17, 0.12, -0.02);
      riderHips.localToWorld(tv);
      if (weight < 1) tv.lerpVectors(j.hand[i].getWorldPosition(fk), tv, weight);
      pole.set(side * 0.8, -0.5, -0.2).applyQuaternion(q);
      solveTwoBone(j.arm[i], j.forearm[i], j.hand[i], tv, pole);
      tv.set(side * 0.2, 0.42, pegZ);
      frame.localToWorld(tv);
      if (weight < 1) tv.lerpVectors(j.foot[i].getWorldPosition(fk), tv, weight);
      pole.set(side * 0.3, 0.1, 1).applyQuaternion(q);
      solveTwoBone(j.thigh[i], j.shin[i], j.foot[i], tv, pole);
    }
  }

  dispose(): void {
    for (const p of this.parts) releasePart(this.assets, p);
    releasePart(this.assets, this.body);
  }
}
