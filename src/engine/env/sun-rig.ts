import { DirectionalLight, Vector3 } from 'three';
import type { QualitySettings } from '../quality';

const UP = new Vector3(0, 1, 0);
const right = new Vector3();
const upv = new Vector3();
const snapped = new Vector3();

/**
 * The sun (moon at night): a DirectionalLight whose orthographic shadow frustum follows a focus point.
 * The focus is snapped to whole shadow texels in light space so shadows don't shimmer while riding.
 */
export class SunRig {
  readonly light = new DirectionalLight(0xffffff, 3);
  /** unit vector pointing TOWARD the light */
  readonly direction = new Vector3(0, 1, 0);
  private extent = 36;
  private distance = 90;

  constructor(quality: QualitySettings) {
    this.light.name = 'sun';
    this.light.castShadow = true;
    const s = this.light.shadow;
    s.bias = -0.0004;
    s.normalBias = 0.035;
    s.camera.near = 1;
    this.applyQuality(quality);
  }

  applyQuality(q: QualitySettings): void {
    const s = this.light.shadow;
    this.light.castShadow = q.shadows;
    this.extent = q.shadowExtent;
    this.distance = Math.max(80, q.shadowExtent * 2.2);
    s.radius = q.shadowRadius;
    s.camera.left = -this.extent;
    s.camera.right = this.extent;
    s.camera.top = this.extent;
    s.camera.bottom = -this.extent;
    s.camera.far = this.distance * 2;
    s.camera.updateProjectionMatrix();
    if (s.mapSize.x !== q.shadowMapSize) {
      s.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      s.map?.dispose();
      s.map = null;
    }
  }

  /** set the light direction from elevation/azimuth in degrees (azimuth 0 = from +Z, 90 = from +X) */
  setAngles(elevationDeg: number, azimuthDeg: number): void {
    const el = (elevationDeg * Math.PI) / 180;
    const az = (azimuthDeg * Math.PI) / 180;
    this.direction.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  }

  /** move light + shadow frustum to cover `focus` (texel-snapped) */
  follow(focus: Vector3): void {
    const d = this.direction;
    right.crossVectors(UP, d);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    upv.crossVectors(d, right).normalize();
    const texel = (2 * this.extent) / this.light.shadow.mapSize.x;
    const x = Math.round(focus.dot(right) / texel) * texel;
    const y = Math.round(focus.dot(upv) / texel) * texel;
    const z = focus.dot(d);
    snapped.set(0, 0, 0).addScaledVector(right, x).addScaledVector(upv, y).addScaledVector(d, z);
    this.light.target.position.copy(snapped);
    this.light.position.copy(snapped).addScaledVector(d, this.distance);
    this.light.target.updateMatrixWorld();
  }
}
