import type { MeshStandardMaterial, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { PlayerState } from '../../core/types';
import { findMaterials } from '../../engine/assets/material-tools';
import type { QualitySettings } from '../../engine/quality';
import type { RiderRig } from '../rig/rider-rig';
import { DashScreen } from './dash-screen';
import { MirrorGlass } from './mirror-glass';

/**
 * First-person cockpit (mockup 02) on top of the rider rig: hides the rider's head/torso so the camera sits in
 * the helmet, lights the `Dash_Screen` LCD with the speed, and turns the mirror glass into rear views — live
 * reflections from small render targets on the `high` preset, a painted rear view otherwise. The gloved hands on
 * the grips, steering bars and lean come from the rig itself; head bob + lean roll are the camera's (POV framing).
 */
export class PovCockpit {
  private readonly dash = new DashScreen();
  private readonly mirrors: [MirrorGlass, MirrorGlass] = [new MirrorGlass(1), new MirrorGlass(-1)];
  private dashMats: MeshStandardMaterial[] = [];
  private camera: PerspectiveCamera | null = null;
  private active = false;
  private reflective = false;
  private frame = 0;

  constructor(private readonly rig: RiderRig, quality: QualitySettings) {
    this.rebind();
    this.setQuality(quality);
  }

  /** the player camera (mirror reflections render relative to the rider's view) */
  attach(camera: PerspectiveCamera): void {
    this.camera = camera;
  }

  /** after the rig swapped bikes */
  rebind(): void {
    const was = this.active;
    this.setActive(false);
    this.dashMats = findMaterials(this.rig.bike, 'Dash_Screen');
    for (const m of this.dashMats) {
      m.map = this.dash.texture;
      m.emissiveMap = this.dash.texture;
      m.emissive.set('#ffffff');
      m.emissiveIntensity = 0.95;
      m.color.set('#ffffff');
      m.roughness = 0.3;
      m.needsUpdate = true;
    }
    for (const mg of this.mirrors) mg.bind(this.rig.bike);
    this.setActive(was);
  }

  setQuality(q: QualitySettings): void {
    this.reflective = q.preset === 'high';
    for (const mg of this.mirrors) mg.setReflective(this.reflective);
  }

  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    this.rig.setFirstPerson(on);
    for (const mg of this.mirrors) mg.setActive(on);
  }

  get isActive(): boolean {
    return this.active;
  }

  /** dash readout (always — it is also visible on the bike in the chase cameras) and mirror tint */
  update(s: PlayerState, speedKmh: number, night = 0): void {
    const load = s.fallen ? 0 : Math.min(1, Math.abs(s.speed) / 22 + Math.max(0, s.accel) * 0.12);
    this.dash.draw(speedKmh, load);
    for (const mg of this.mirrors) mg.tint(night);
  }

  /**
   * High preset + POV only: render one mirror per frame (alternating) into its small target, with the rider
   * hidden and the shadow map reused. Call before `engine.render()`.
   */
  renderMirrors(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera | null = this.camera): void {
    if (!this.active || !this.reflective || !camera) return;
    const mg = this.mirrors[this.frame++ % 2];
    const rt = mg.aim(this.rig.root.rotation.y);
    if (!rt) return;
    const prevTarget = renderer.getRenderTarget();
    const prevShadow = renderer.shadowMap.autoUpdate;
    const rigVisible = this.rig.root.visible;
    this.rig.root.visible = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.render(scene, mg.cam);
    renderer.setRenderTarget(prevTarget);
    renderer.shadowMap.autoUpdate = prevShadow;
    this.rig.root.visible = rigVisible;
  }

  dispose(): void {
    this.setActive(false);
    for (const m of this.dashMats) {
      m.map = null;
      m.emissiveMap = null;
    }
    this.dash.dispose();
    for (const mg of this.mirrors) mg.dispose();
  }
}
