import { Group, type Object3D } from 'three';
import { PALETTE as P } from '../../../core/config/palette';
import { damp } from '../../../core/math2d';
import type { Vec2 } from '../../../core/types';
import type { Assets } from '../../../engine/assets/assets';
import { findNode, setColor } from '../../../engine/assets/material-tools';
import { applyPose, type BodyJoints, bodyJoints, POSES } from '../../../player/rig/joints';
import { bump, span } from '../../../player/rig/keyframes';

/** Lek's look: warm skin, a hot-pink blouse, dark sarong-trousers, hair in a bun */
const LOOK = { skin: P.skin3, shirt: '#E2557F', pants: '#3B3346', shoes: '#2B2A2E', hair: '#2A211E' } as const;
const WAVE_TIME = 2.6;

/**
 * Aunt Lek (ป้าเล็ก) at her khao man gai cart: chops chicken with a steady rhythm, glances up at the rider now and
 * then, and waves the rider off when a job is accepted (`wave()`).
 */
export class AuntLek {
  readonly root = new Group();
  private readonly body: Object3D;
  private readonly hair: Object3D;
  private readonly j: BodyJoints;
  private t = 0;
  private waveT = Infinity;
  private look = 0;

  constructor(private readonly assets: Assets, at: { pos: Vec2; heading: number }, ground: number) {
    this.root.name = 'aunt_lek';
    this.body = assets.instance('char_body');
    for (const [m, c] of [['Skin', LOOK.skin], ['Hands', LOOK.skin], ['Shirt', LOOK.shirt], ['Pants', LOOK.pants],
      ['Shoes', LOOK.shoes], ['Hair', LOOK.hair]] as const) setColor(this.body, m, c);
    this.hair = assets.instance('hair_bun');
    setColor(this.hair, 'Hair', LOOK.hair);
    (findNode(this.body, 'head') ?? this.body).add(this.hair);
    this.j = bodyJoints(this.body);
    this.root.add(this.body);
    this.root.position.set(at.pos.x, ground, at.pos.z);
    this.root.rotation.y = at.heading;
  }

  /** waves the rider off (accept) */
  wave(): void {
    this.waveT = 0;
  }

  /** `riderYaw` = heading toward the rider relative to Lek's own (the glance target) */
  update(dt: number, riderYaw: number): void {
    this.t += dt;
    this.waveT += dt;
    const j = this.j;
    const t = this.t;
    applyPose(j, POSES.stand);
    const waving = this.waveT < WAVE_TIME;
    const w = waving ? span(this.waveT, 0, 0.35) * (1 - span(this.waveT, WAVE_TIME - 0.5, WAVE_TIME)) : 0;
    // glance at the rider every few seconds (always while waving)
    const glance = waving ? 1 : bump((t % 7.5) / 7.5, 0.55, 0.85);
    this.look += (glance * Math.max(-1.1, Math.min(1.1, riderYaw)) - this.look) * damp(5, dt);
    j.head.rotation.y = this.look * 0.75;
    j.torso.rotation.y = this.look * 0.25;
    j.torso.rotation.x = 0.12 * (1 - w) + Math.sin(t * 0.9) * 0.015;
    // left hand steadies the chicken on the board; right hand chops (2.3 Hz) unless waving
    j.arm[0].rotation.set(-0.55, 0, -0.08);
    j.forearm[0].rotation.set(-1.05, 0, 0);
    const chop = Math.max(0, Math.sin(t * 2.3 * Math.PI * 2)) * (1 - w);
    j.arm[1].rotation.set(-0.5 - chop * 0.12 + w * 0.1, 0, -w * 2.45);
    j.forearm[1].rotation.set(-0.95 - chop * 0.45 + w * 0.95, 0, w * Math.sin(this.waveT * 13) * 0.45);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.assets.release(this.hair);
    this.assets.release(this.body);
  }
}
