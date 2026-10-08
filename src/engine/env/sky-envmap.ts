import { Mesh, PMREMGenerator, Scene, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import type { SkyDome } from './sky-dome';

/**
 * Image-based lighting baked from the live sky dome (PMREM). Glossy paint and chrome reflect the actual
 * time-of-day sky; diffuse IBL adds the sky-coloured fill. Re-baked only when the look changes noticeably,
 * at most every `minInterval` seconds.
 */
export class SkyEnvMap {
  private readonly pmrem: PMREMGenerator;
  private readonly scene = new Scene();
  private target: WebGLRenderTarget | null = null;
  private lastSignature = Number.NaN;
  private sinceBake = Infinity;
  minInterval = 0.8;

  constructor(renderer: WebGLRenderer, sky: SkyDome, private size: number) {
    this.pmrem = new PMREMGenerator(renderer);
    const mesh = new Mesh(sky.mesh.geometry, sky.material);
    mesh.scale.setScalar(10);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  get texture(): Texture | null {
    return this.target?.texture ?? null;
  }

  setSize(size: number): void {
    if (size === this.size) return;
    this.size = size;
    this.lastSignature = Number.NaN;
  }

  /**
   * @param signature cheap scalar summary of the look; a bake happens when it moved by > epsilon
   * @returns true when a new texture was produced
   */
  update(dt: number, signature: number, force = false): boolean {
    this.sinceBake += dt;
    if (this.size <= 0) {
      this.release();
      return false;
    }
    const changed = !(Math.abs(signature - this.lastSignature) < 0.004);
    if (!force && (!changed || this.sinceBake < this.minInterval)) return false;
    const next = this.pmrem.fromScene(this.scene, 0, 0.1, 100, { size: this.size });
    this.target?.dispose();
    this.target = next;
    this.lastSignature = signature;
    this.sinceBake = 0;
    return true;
  }

  release(): void {
    this.target?.dispose();
    this.target = null;
    this.lastSignature = Number.NaN;
  }

  dispose(): void {
    this.release();
    this.pmrem.dispose();
  }
}
