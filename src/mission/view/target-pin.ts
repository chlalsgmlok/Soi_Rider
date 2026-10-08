import { Group, Vector3 } from 'three';
import { PALETTE } from '../../core/config/palette';
import { clamp } from '../../core/math2d';
import type { Vec2 } from '../../core/types';
import { STOP_RADIUS } from '../run/phase-flow';
import { INNER_RING } from '../run/smooth-arrival';
import { createGroundRing, tickRing } from './ground-ring';
import { buildPinMesh, PIN_H } from './pin-mesh';

/** the pin tip floats this high above the ground (m) */
const HOVER = 2.3;
const BOB = 0.18;
const SPIN = 1.25;
/** keeps the pin readable from afar: it grows with camera distance beyond this (m) */
const NEAR = 26;
const MAX_SCALE = 3.2;

/**
 * Coral target pin (bob + spin) over a coral stop zone on the ground: solid inner ring (smooth-arrival target), dashed
 * 4 m stop radius and expanding pulses. `setTarget` moves it (pops in), `setTarget(null)` shrinks it away.
 */
export class TargetPin {
  readonly root = new Group();
  private readonly pin = buildPinMesh();
  private readonly rings = createGroundRing({
    color: PALETTE.pinCoral, radius: INNER_RING, width: 0.06, outer: STOP_RADIUS, dashes: 28, pulse: 1.7, pulseTo: STOP_RADIUS,
    fill: 0.07, glow: 0.3,
  });
  private readonly head = new Vector3();
  private time = 0;
  private show = 0;
  private wanted = false;

  constructor() {
    this.root.name = 'target_pin';
    this.root.visible = false;
    this.root.add(this.pin.root, this.rings);
  }

  /** place on a target (ground height in m), or null to hide */
  setTarget(pos: Vec2 | null, groundY = 0): void {
    this.wanted = pos !== null;
    if (!pos) return;
    const moved = Math.hypot(this.root.position.x - pos.x, this.root.position.z - pos.z) > 0.5;
    if (moved && this.show > 0.5) this.show = 0;
    this.root.position.set(pos.x, groundY, pos.z);
  }

  update(dt: number, camPos: Vector3 | null): void {
    this.time += dt;
    this.show = clamp(this.show + (this.wanted ? dt * 2.2 : -dt * 3), 0, 1);
    this.root.visible = this.show > 0.001;
    if (!this.root.visible) return;
    const t = this.show;
    const ease = t * t * (3 - 2 * t);
    // springy pop in (back-out), plain ease out
    const pop = this.wanted ? 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2 : ease;
    const far = camPos ? clamp(camPos.distanceTo(this.root.position) / NEAR, 1, MAX_SCALE) : 1;
    const s = pop * far;
    const p = this.pin.root;
    p.scale.setScalar(Math.max(1e-3, s));
    p.position.y = (HOVER + Math.sin(this.time * 2.2) * BOB) * (0.6 + 0.4 * far);
    p.rotation.y += SPIN * dt;
    p.rotation.y %= Math.PI * 2;
    tickRing(this.rings, this.time, ease);
  }

  /** world position of the pin head (HUD anchor) */
  anchor(out: Vector3 = this.head): Vector3 {
    const p = this.pin.root;
    return out.set(0, PIN_H * p.scale.y, 0).add(p.position).add(this.root.position);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.pin.dispose();
    this.rings.geometry.dispose();
    this.rings.material.dispose();
  }
}
