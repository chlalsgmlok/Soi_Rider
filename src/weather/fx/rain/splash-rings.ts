import {
  Color, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial,
  UniformsLib, UniformsUtils,
} from 'three';
import type { Rng } from '../../../core/rng';
import type { Circle } from '../../../core/types';
import { addScaled, type FxFrame } from '../fx-frame';

const VERT = /* glsl */ `
attribute vec4 aRing;
attribute vec2 aShape;
uniform float uTime;
varying float vT;
varying float vNear;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vT = (uTime - aRing.w) / aShape.y;
  if (vT < 0.0 || vT > 1.0) {
    gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    return;
  }
  vUv = position.xy * 2.0;
  vec4 mvPosition = viewMatrix * vec4(aRing.x + position.x * aShape.x, aRing.y, aRing.z + position.y * aShape.x, 1.0);
  vNear = smoothstep(1.5, 5.0, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

/** an impact dot, then two expanding ripples that thin out and fade */
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vT;
varying float vNear;
varying vec2 vUv;
#include <fog_pars_fragment>
float ring(float r, float radius, float width) {
  return 1.0 - smoothstep(0.0, width, abs(r - radius));
}
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float e = 1.0 - (1.0 - vT) * (1.0 - vT);
  float a = ring(r, 0.1 + 0.88 * e, 0.06 + 0.1 * vT) * (1.0 - vT);
  a += 0.55 * ring(r, 0.55 * e, 0.05 + 0.08 * vT) * (1.0 - vT) * step(0.12, vT);
  a += (1.0 - smoothstep(0.0, 0.14, r)) * (1.0 - smoothstep(0.0, 0.18, vT));
  gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0) * uOpacity * (0.35 + 0.65 * vNear));
  #include <fog_fragment>
}`;

const SPAWN_R = 15;
const AHEAD = 5;
const scratch: Circle[] = [];

/**
 * Raindrop impacts on the ground near the rider: expanding ripple rings (bigger in puddles), one draw call.
 * Rings are respawned on the CPU only when they expire (≈ capacity / 0.55 s), at the real ground height.
 */
export class SplashRings {
  readonly mesh: Mesh;
  private readonly geometry = new InstancedBufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly ring: InstancedBufferAttribute;
  private readonly shape: InstancedBufferAttribute;
  private readonly color = new Color();
  private near: Circle[] = [];
  private nearTimer = 0;
  /** live ring budget ≤ capacity */
  private limit: number;

  constructor(private readonly capacity: number, private readonly rng: Rng, private readonly puddles: readonly Circle[]) {
    this.limit = capacity;
    const quad = new PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.ring = new InstancedBufferAttribute(new Float32Array(capacity * 4).fill(-1e4), 4).setUsage(DynamicDrawUsage);
    this.shape = new InstancedBufferAttribute(new Float32Array(capacity * 2).fill(1), 2).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('aRing', this.ring);
    this.geometry.setAttribute('aShape', this.shape);
    this.geometry.instanceCount = capacity;
    this.material = new ShaderMaterial({
      name: 'Weather_Ripples', vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
      side: DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uColor: { value: this.color }, uOpacity: { value: 0 } }]),
    });
    this.material.uniforms.uColor.value = this.color;
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'weather_ripples';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  /** lower (or restore up to capacity) the number of live ripples */
  setLimit(n: number): void {
    this.limit = Math.max(0, Math.min(this.capacity, n));
    this.geometry.instanceCount = this.limit;
  }

  update(f: FxFrame): void {
    const rain = f.state.rain;
    const live = rain > 0.01 || this.mesh.visible;
    this.material.uniforms.uTime.value = f.time;
    if (!live) return;
    this.refreshPuddles(f);
    const r = this.ring.array as Float32Array;
    const s = this.shape.array as Float32Array;
    let alive = 0;
    let dirty = false;
    for (let i = 0; i < this.limit; i++) {
      if (f.time - r[i * 4 + 3] < s[i * 2 + 1]) {
        alive++;
        continue;
      }
      if (rain < 0.01 || this.rng.next() > rain * 1.4) continue;
      this.spawn(f, i, r, s);
      alive++;
      dirty = true;
    }
    if (dirty) {
      this.ring.needsUpdate = true;
      this.shape.needsUpdate = true;
    }
    this.mesh.visible = alive > 0;
    this.material.uniforms.uOpacity.value = 0.45 + 0.25 * f.state.wetness;
    const l = f.light;
    addScaled(addScaled(this.color.copy(l.ambient).multiplyScalar(2.1), l.sun, 0.3), l.lampGlow, 2.5);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private spawn(f: FxFrame, i: number, r: Float32Array, s: Float32Array): void {
    const rng = this.rng;
    let x: number;
    let z: number;
    let size = rng.range(0.16, 0.3);
    const puddle = this.near.length > 0 && f.state.wetness > 0.35 && rng.next() < 0.18 ? rng.pick(this.near) : null;
    if (puddle) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * puddle.r * 0.8;
      x = puddle.cx + Math.cos(a) * d;
      z = puddle.cz + Math.sin(a) * d;
      size *= 1.3;
    } else {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * SPAWN_R;
      x = f.focus.x + f.ahead.x * AHEAD + Math.cos(a) * d;
      z = f.focus.z + f.ahead.z * AHEAD + Math.sin(a) * d;
    }
    r[i * 4] = x;
    r[i * 4 + 1] = f.groundHeight(x, z) + 0.014;
    r[i * 4 + 2] = z;
    r[i * 4 + 3] = f.time + rng.range(0, 0.05);
    s[i * 2] = size;
    s[i * 2 + 1] = rng.range(0.42, 0.7);
  }

  /** the puddles worth rippling: within reach of the spawn disc (refreshed twice a second) */
  private refreshPuddles(f: FxFrame): void {
    this.nearTimer -= f.dt;
    if (this.nearTimer > 0) return;
    this.nearTimer = 0.5;
    scratch.length = 0;
    const cx = f.focus.x + f.ahead.x * AHEAD;
    const cz = f.focus.z + f.ahead.z * AHEAD;
    for (const p of this.puddles) if (Math.hypot(p.cx - cx, p.cz - cz) < SPAWN_R + p.r) scratch.push(p);
    this.near = scratch.slice();
  }
}
