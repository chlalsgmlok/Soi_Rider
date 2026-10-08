import {
  type Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial,
  UniformsLib, UniformsUtils, Vector3,
} from 'three';
import { ParticlePool } from './particle-pool';

/** 'mist' = soft light blobs (spray, steam), 'smoke' = soft dark puffs (exhaust), 'drop' = crisp bright droplets */
export type ParticleLook = 'mist' | 'smoke' | 'drop';

const VERT = /* glsl */ `
attribute vec4 iPos;
attribute vec4 iCol;
#ifdef DROP
attribute vec3 iVel;
#endif
uniform vec3 uLight;
varying vec4 vCol;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = position.xy * 2.0;
  vec4 mvPosition = viewMatrix * vec4(iPos.xyz, 1.0);
#ifdef DROP
  // flying water: stretch each droplet along its on-screen motion (motion blur)
  vec4 trail = viewMatrix * vec4(iPos.xyz - iVel * 0.05, 1.0);
  vec2 dir = mvPosition.xy - trail.xy;
  float len = length(dir);
  vec2 ax = len > 1e-4 ? dir / len : vec2(0.0, 1.0);
  mvPosition.xy += vec2(-ax.y, ax.x) * position.x * iPos.w + ax * position.y * (iPos.w + len);
#else
  mvPosition.xy += position.xy * iPos.w;
#endif
  // nothing smears across the lens
  vCol = vec4(iCol.rgb * uLight, iCol.a * smoothstep(0.3, 1.4, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
varying vec4 vCol;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
#ifdef DROP
  vec2 hl = vUv + vec2(0.35, -0.35);
  float a = smoothstep(1.0, 0.5, r2);
  vec3 c = vCol.rgb * (0.8 + 0.9 * smoothstep(0.3, 0.0, dot(hl, hl)));
#else
  float a = exp(-r2 * 3.0) * (1.0 - r2);
  vec3 c = vCol.rgb;
#endif
  gl_FragColor = vec4(c, a * vCol.a);
  #include <fog_fragment>
}`;

/**
 * Renders a ParticlePool as camera-facing soft quads in ONE draw call (instanced; position/size and
 * albedo/alpha streamed per frame). Particles store albedo; `uLight` lights them all at once.
 */
export class ParticleLayer {
  readonly mesh: Mesh;
  readonly pool: ParticlePool;
  private readonly geometry = new InstancedBufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly iPos: InstancedBufferAttribute;
  private readonly iCol: InstancedBufferAttribute;
  /** droplets only: velocity for the motion stretch */
  private readonly iVel: InstancedBufferAttribute | null;
  private readonly streams: InstancedBufferAttribute[];
  private readonly light = new Vector3();

  constructor(capacity: number, look: ParticleLook, name: string) {
    this.pool = new ParticlePool(capacity);
    const quad = new PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.iPos = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);
    this.iCol = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('iPos', this.iPos);
    this.geometry.setAttribute('iCol', this.iCol);
    this.iVel = look === 'drop' ? new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage) : null;
    if (this.iVel) this.geometry.setAttribute('iVel', this.iVel);
    this.streams = this.iVel ? [this.iPos, this.iCol, this.iVel] : [this.iPos, this.iCol];
    this.geometry.instanceCount = 0;
    this.material = new ShaderMaterial({
      name, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uLight: { value: this.light } }]),
      defines: look === 'drop' ? { DROP: 1 } : {},
    });
    this.material.uniforms.uLight.value = this.light;
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = look === 'drop' ? 14 : 12;
    this.mesh.visible = false;
  }

  /** simulate and stream to the GPU; `light` = radiance a white particle reflects now */
  update(dt: number, windX: number, windZ: number, light: Color): void {
    const p = this.pool;
    p.step(dt, windX, windZ);
    this.light.set(light.r, light.g, light.b);
    const f = p.f;
    const pos = this.iPos.array as Float32Array;
    const col = this.iCol.array as Float32Array;
    const vel = this.iVel ? (this.iVel.array as Float32Array) : null;
    for (let i = 0; i < p.count; i++) {
      const t = f.age[i] / f.life[i];
      const grow = 1 - (1 - t) * (1 - t);
      const fade = Math.min(1, t * 9) * (1 - t) ** 1.3;
      const o = i * 4;
      pos[o] = f.x[i];
      pos[o + 1] = f.y[i];
      pos[o + 2] = f.z[i];
      pos[o + 3] = f.s0[i] + (f.s1[i] - f.s0[i]) * grow;
      col[o] = f.r[i];
      col[o + 1] = f.g[i];
      col[o + 2] = f.b[i];
      col[o + 3] = f.a[i] * fade;
      if (vel) {
        vel[i * 3] = f.vx[i];
        vel[i * 3 + 1] = f.vy[i];
        vel[i * 3 + 2] = f.vz[i];
      }
    }
    for (const a of this.streams) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, p.count * a.itemSize);
      a.needsUpdate = p.count > 0;
    }
    this.geometry.instanceCount = p.count;
    this.mesh.visible = p.count > 0;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
