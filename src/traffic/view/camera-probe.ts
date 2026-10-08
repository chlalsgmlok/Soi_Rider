import { type Camera, Frustum, Matrix4, Sphere, Vector3 } from 'three';
import { type CityQuery, Surface, type Vec2 } from '../../core/types';
import type { ViewProbe } from '../sim/types';

/** roof height under which a building blocks the line of sight (lowest shophouse ≈ 7.5 m) */
const ROOF = 7;
const STEP = 1;

/**
 * "Can the camera see an agent here?" for the traffic spawner: inside the view frustum (with a margin), closer than
 * the draw distance, and not hidden behind a building — a 2D march from the camera's ground point over the surface
 * raster, occluded where the sight line passes a building cell below roof height.
 */
export class CameraProbe implements ViewProbe {
  private readonly frustum = new Frustum();
  private readonly m = new Matrix4();
  private readonly sphere = new Sphere();
  private readonly cam = new Vector3();
  private far = 340;

  constructor(private readonly city: CityQuery, private readonly margin = 2.5) {}

  /** call once per frame after the camera moved */
  update(camera: Camera, drawDistance: number): void {
    camera.updateMatrixWorld();
    this.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m);
    this.cam.setFromMatrixPosition(camera.matrixWorld);
    this.far = drawDistance;
  }

  isVisible(p: Vec2, radius: number): boolean {
    const dx = p.x - this.cam.x;
    const dz = p.z - this.cam.z;
    const d = Math.hypot(dx, dz);
    if (d > this.far) return false;
    this.sphere.center.set(p.x, 1.2, p.z);
    this.sphere.radius = radius + this.margin;
    if (!this.frustum.intersectsSphere(this.sphere)) return false;
    return !this.occluded(dx, dz, d);
  }

  private occluded(dx: number, dz: number, d: number): boolean {
    const camY = this.cam.y;
    let run = 0;
    for (let s = STEP; s < d - 2; s += STEP) {
      const t = s / d;
      const y = camY + (1.2 - camY) * t;
      if (y > ROOF + 2) continue;
      const code = this.city.surfaceAt(this.cam.x + dx * t, this.cam.z + dz * t);
      run = code === Surface.Building && y < ROOF ? run + 1 : 0;
      if (run >= 2) return true;
    }
    return false;
  }
}
