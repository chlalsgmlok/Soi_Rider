import {
  AdditiveBlending, Color, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial,
  Vector3,
} from 'three';
import { smoothstep } from '../../../core/math2d';
import type { Rng } from '../../../core/rng';
import type { FxFrame } from '../fx-frame';

const VERT = /* glsl */ `
attribute vec4 aSeed;
uniform vec3 uCenter;
uniform float uSpan;
uniform float uTime;
uniform float uPx;
uniform vec3 uSunDir;
varying float vGlow;
varying vec2 vUv;
void main() {
  // slow brownian float on a lattice around the rider
  float ph = aSeed.w * 6.2831;
  vec3 wob = vec3(sin(uTime * 0.31 + ph), sin(uTime * 0.23 + ph * 1.7) * 0.6, cos(uTime * 0.27 + ph * 2.3)) * 0.8;
  vec3 p = vec3(aSeed.x * uSpan, aSeed.y * 4.5, aSeed.z * uSpan) + wob;
  p.xz = uCenter.xz + mod(p.xz - uCenter.xz + 0.5 * uSpan, uSpan) - 0.5 * uSpan;
  p.y += uCenter.y + 0.3;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  float depth = max(-mvPosition.z, 0.05);
  float size = max(0.035, uPx * depth);
  mvPosition.xy += position.xy * size;
  // Mie forward scattering: motes light up when the camera looks toward the sun
  vec3 v = normalize(p - cameraPosition);
  float fwd = pow(max(dot(v, uSunDir), 0.0), 8.0);
  vGlow = (0.3 + 2.4 * fwd) * (0.035 / size) * (0.55 + 0.45 * sin(uTime * (0.8 + aSeed.w) + ph)) * smoothstep(0.6, 2.0, depth);
  vUv = position.xy * 2.0;
  gl_Position = projectionMatrix * mvPosition;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vGlow;
varying vec2 vUv;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(uColor * vGlow * (1.0 - r2) * (1.0 - r2), 1.0);
}`;

const SPAN = 16;
const MIN_PX = 1.6;

/**
 * Dust motes drifting in the low sunbeams of morning and sunset (subtle additive sparkles around the rider, one
 * draw call, GPU animated). Hidden at noon, at night, in rain and in thick smog.
 */
export class DustMotes {
  readonly mesh: Mesh;
  private readonly geometry = new InstancedBufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly color = new Color();

  constructor(private readonly capacity: number, rng: Rng) {
    const count = capacity;
    const quad = new PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    const seeds = new Float32Array(Math.max(1, count) * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next();
    this.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
    this.geometry.instanceCount = count;
    this.material = new ShaderMaterial({
      name: 'Weather_Motes', vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uCenter: { value: new Vector3() }, uSpan: { value: SPAN }, uTime: { value: 0 }, uPx: { value: 0.002 },
        uSunDir: { value: new Vector3(0, 1, 0) }, uColor: { value: this.color },
      },
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'weather_motes';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 16;
    this.mesh.visible = false;
  }

  /** live instance budget ≤ capacity */
  setCount(n: number): void {
    this.geometry.instanceCount = Math.max(0, Math.min(this.capacity, n));
  }

  update(f: FxFrame): void {
    const l = f.light;
    const low = smoothstep(-0.02, 0.12, l.sunDir.y) * (1 - smoothstep(0.45, 0.75, l.sunDir.y));
    const s = f.state;
    const k = low * (1 - l.night) * (1 - smoothstep(0.0, 0.08, s.rain)) * (1 - smoothstep(0.4, 0.85, s.haze)) * (1 - 0.8 * s.overcast);
    this.mesh.visible = k > 0.02 && this.geometry.instanceCount > 0;
    if (!this.mesh.visible) return;
    const u = this.material.uniforms;
    (u.uCenter.value as Vector3).set(f.focus.x + f.ahead.x * 5, f.groundHeight(f.focus.x, f.focus.z), f.focus.z + f.ahead.z * 5);
    (u.uSunDir.value as Vector3).copy(l.sunDir);
    u.uTime.value = f.time % 1000;
    u.uPx.value = MIN_PX / f.pxPerUnit;
    this.color.copy(l.sun).multiplyScalar(0.55 * k);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
