import {
  AdditiveBlending, DoubleSide, Mesh, MeshBasicMaterial, type MeshStandardMaterial, type Object3D, PlaneGeometry,
  SpotLight, Sprite, SpriteMaterial,
} from 'three';
import { smoothstep } from '../../core/math2d';
import { findMaterials, findNode } from '../../engine/assets/material-tools';
import type { QualitySettings } from '../../engine/quality';
import { beamTexture, glowTexture } from './glow-textures';

const BRAKE_RED = '#ff2b1c';

/**
 * Brake light (emission while braking), tail + head lamp emission that rise with the street lamps, a glow sprite on
 * the headlamp and a warm pool on the asphalt ahead. On the `high` preset a real SpotLight joins (no shadows);
 * otherwise the emissive + glow + pool fake it for free.
 */
export class BikeLights {
  readonly beam: Mesh;
  private readonly glow: Sprite;
  private spot: SpotLight | null = null;
  private brakeMats: MeshStandardMaterial[] = [];
  private tailMats: MeshStandardMaterial[] = [];
  private headMats: MeshStandardMaterial[] = [];
  private lampNode: Object3D | null = null;
  private brake = 0;

  constructor(ground: Object3D, private quality: QualitySettings) {
    const geo = new PlaneGeometry(4.4, 9.5);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0.025, 9.5 / 2 + 0.55);
    this.beam = new Mesh(geo, new MeshBasicMaterial({
      map: beamTexture(), color: '#ffe3b0', transparent: true, blending: AdditiveBlending, depthWrite: false,
      side: DoubleSide, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    }));
    this.beam.name = 'headlight_pool';
    this.beam.renderOrder = 4;
    this.beam.visible = false;
    ground.add(this.beam);
    this.glow = new Sprite(new SpriteMaterial({
      map: glowTexture(), color: '#fff0d0', blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
    }));
    this.glow.scale.setScalar(0.55);
    this.glow.visible = false;
  }

  /** hook onto a (new) bike instance */
  bind(bike: Object3D): void {
    this.brakeMats = findMaterials(bike, 'Light_Brake');
    this.tailMats = findMaterials(bike, 'Light_Tail');
    this.headMats = findMaterials(bike, 'Light_Head');
    for (const m of this.brakeMats) m.emissive.set(BRAKE_RED);
    this.lampNode = findNode(bike, 'headlight') ?? bike;
    this.lampNode.add(this.glow);
    this.glow.position.set(0, 0, 0.05);
    this.setQuality(this.quality, true);
  }

  setQuality(q: QualitySettings, force = false): void {
    if (q === this.quality && !force) return;
    this.quality = q;
    if (this.spot) {
      this.spot.removeFromParent();
      this.spot.target.removeFromParent();
      this.spot.dispose();
      this.spot = null;
    }
    if (q.preset !== 'high' || !this.lampNode) return;
    this.spot = new SpotLight('#ffe6bf', 0, 30, 0.52, 0.55, 1.4);
    this.spot.castShadow = false;
    this.spot.position.set(0, 0, 0.05);
    this.spot.target.position.set(0, -0.9, 9);
    this.lampNode.add(this.spot, this.spot.target);
  }

  /**
   * `braking` lights the brake lamp; `lamps` 0..1 = Environment.lampsOn (lamp emission + glow);
   * `night` 0..1 = Environment.night (the pool on the road only shows once it is properly dark); `bars` = steer yaw
   */
  update(dt: number, braking: boolean, lamps: number, night: number, bars: number): void {
    this.brake += ((braking ? 1 : 0) - this.brake) * Math.min(1, dt * 22);
    for (const m of this.brakeMats) m.emissiveIntensity = 2.8 * this.brake + 0.25 * lamps;
    for (const m of this.tailMats) m.emissiveIntensity = 0.45 + 2 * lamps;
    for (const m of this.headMats) m.emissiveIntensity = 0.9 + 3 * lamps;
    const on = lamps > 0.02;
    const dark = lamps * smoothstep(0.1, 0.8, night);
    this.glow.visible = on;
    this.beam.visible = dark > 0.01;
    if (this.spot) this.spot.intensity = 9 * dark;
    if (!on) return;
    (this.glow.material as SpriteMaterial).opacity = Math.min(1, lamps * 1.1);
    (this.beam.material as MeshBasicMaterial).opacity = 0.45 * dark;
    this.beam.rotation.y = bars * 0.85;
  }

  dispose(): void {
    this.beam.removeFromParent();
    this.beam.geometry.dispose();
    (this.beam.material as MeshBasicMaterial).dispose();
    this.glow.removeFromParent();
    this.glow.material.dispose();
    this.spot?.removeFromParent();
    this.spot?.dispose();
  }
}
