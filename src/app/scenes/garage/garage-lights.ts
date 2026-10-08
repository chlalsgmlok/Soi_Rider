import {
  CylinderGeometry, DirectionalLight, Group, Mesh, MeshBasicMaterial, PointLight, SphereGeometry, SpotLight, Vector3,
} from 'three';
import { PALETTE as P } from '../../../core/config/palette';
import type { QualitySettings } from '../../../engine/quality';

/** where the bare bulb hangs (under the awning's front edge, right of the neon) */
const BULB = new Vector3(1.45, 2.3, 1.42);
const AWNING_UNDERSIDE = 2.62;

/**
 * Night lighting of the garage set on top of the Environment's moonlight: a bare warm bulb on a cord (spot with soft
 * shadows onto the turntable), warm bounce off the lit pavement, the shop's interior glow rimming the rider from
 * behind, a cool moon rim and the neon's pink spill (follows its flicker).
 */
export class GarageLights {
  readonly root = new Group();
  private readonly spot = new SpotLight('#ffb067', 9, 0, 0.9, 0.7, 2);
  private readonly bounce = new PointLight('#ff9b5a', 1.1, 4.5, 2);
  private readonly shop = new PointLight('#ffb46b', 2, 6, 2);
  private readonly neon = new PointLight(P.neonPink, 3, 4.2, 2);
  private readonly rim = new DirectionalLight('#8fb2ff', 0.9);
  private readonly bulb: Mesh<SphereGeometry, MeshBasicMaterial>;
  private readonly cord: Mesh<CylinderGeometry, MeshBasicMaterial>;

  /** `stage` = turntable centre on the pavement; `neonAt` = the sign's position */
  constructor(quality: QualitySettings, stage: Vector3, neonAt: Vector3) {
    this.root.name = 'garage_lights';
    const glow = new MeshBasicMaterial({ color: '#ffd9a8', toneMapped: false });
    glow.color.multiplyScalar(5);
    this.bulb = new Mesh(new SphereGeometry(0.055, 16, 12), glow);
    this.bulb.position.copy(BULB);
    const cordLen = AWNING_UNDERSIDE - BULB.y;
    this.cord = new Mesh(new CylinderGeometry(0.006, 0.006, cordLen, 6), new MeshBasicMaterial({ color: '#1b1b1f' }));
    this.cord.position.set(BULB.x, BULB.y + cordLen / 2 + 0.05, BULB.z);

    this.spot.position.copy(BULB);
    this.spot.target.position.copy(stage);
    const sh = this.spot.shadow;
    sh.bias = -0.0004;
    sh.normalBias = 0.02;
    sh.radius = 4;
    sh.camera.near = 0.2;
    sh.camera.far = 9;
    this.bounce.position.set(stage.x + 0.3, 0.55, stage.z + 0.9);
    this.shop.position.set(1.1, 1.3, -0.8);
    this.neon.position.set(neonAt.x, neonAt.y - 0.1, neonAt.z + 0.45);
    this.rim.position.set(stage.x - 3.5, 5, stage.z - 3.2);
    this.rim.target.position.copy(stage);
    this.root.add(this.bulb, this.cord, this.spot, this.spot.target, this.bounce, this.shop, this.neon, this.rim, this.rim.target);
    this.setQuality(quality);
  }

  setQuality(q: QualitySettings): void {
    this.spot.castShadow = q.shadows;
    this.spot.shadow.mapSize.setScalar(Math.min(1024, q.shadowMapSize));
    this.spot.shadow.map?.dispose();
    this.spot.shadow.map = null;
  }

  /** `neon` = the sign's current brightness (0..1); `t` sways the bulb on its cord in the night breeze */
  update(t: number, neon: number, still: boolean): void {
    this.neon.intensity = 3 * neon;
    const sway = still ? 0 : Math.sin(t * 1.3) * 0.012;
    this.bulb.position.x = BULB.x + sway;
    this.spot.position.x = BULB.x + sway;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.spot.shadow.map?.dispose();
    for (const l of [this.spot, this.bounce, this.shop, this.neon, this.rim]) l.dispose();
    for (const m of [this.bulb, this.cord]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
