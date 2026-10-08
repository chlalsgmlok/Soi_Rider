import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Uniform, Vector3 } from 'three';
import type { LookState } from './env-look';
import { SKY_FRAG, SKY_VERT } from './sky.glsl';

function skyUniforms() {
  return {
    uZenith: new Uniform(new Color()),
    uHorizon: new Uniform(new Color()),
    uGlow: new Uniform(new Color()),
    uGlowStrength: new Uniform(0),
    uSunDir: new Uniform(new Vector3(0, 1, 0)),
    uSunColor: new Uniform(new Color()),
    uSunDisc: new Uniform(0),
    uMoonDir: new Uniform(new Vector3(0, 1, 0)),
    uMoon: new Uniform(0),
    uStars: new Uniform(0),
    uCloudCover: new Uniform(0),
    uCloudLit: new Uniform(new Color()),
    uCloudShade: new Uniform(new Color()),
    uTime: new Uniform(0),
    uGround: new Uniform(new Color()),
  };
}

export type SkyUniforms = ReturnType<typeof skyUniforms>;

/** Camera-centred sky sphere drawn at the far plane (renderOrder high → only uncovered pixels are shaded). */
export class SkyDome {
  readonly uniforms: SkyUniforms = skyUniforms();
  readonly material: ShaderMaterial;
  readonly mesh: Mesh;
  private readonly geometry = new SphereGeometry(1, 32, 16);

  constructor() {
    this.material = new ShaderMaterial({
      name: 'SkyDome',
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.uniforms,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'sky_dome';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10000;
    this.mesh.scale.setScalar(100);
    // re-centre on whichever camera draws it (main view, PMREM cube camera, debug views)
    this.mesh.onBeforeRender = (_r, _s, camera) => {
      this.mesh.position.setFromMatrixPosition(camera.matrixWorld);
      this.mesh.updateMatrixWorld();
    };
  }

  /** push a look into the shader; `sunDir`/`moonDir` are unit vectors toward the light */
  apply(look: LookState, sunDir: Vector3, moonDir: Vector3, time: number): void {
    const u = this.uniforms;
    u.uZenith.value.copy(look.skyZenith);
    u.uHorizon.value.copy(look.skyHorizon);
    u.uGlow.value.copy(look.skyGlow);
    u.uGlowStrength.value = look.glowStrength;
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.copy(look.sunColor);
    u.uSunDisc.value = look.sunDisc * Math.min(1, Math.max(0, (sunDir.y + 0.02) * 12));
    u.uMoonDir.value.copy(moonDir);
    u.uMoon.value = look.moon;
    u.uStars.value = look.stars;
    u.uCloudCover.value = look.cloudCover;
    u.uCloudLit.value.copy(look.cloudLit);
    u.uCloudShade.value.copy(look.cloudShade);
    u.uTime.value = time;
    u.uGround.value.copy(look.fogColor);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
