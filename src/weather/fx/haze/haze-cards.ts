import {
  Color, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, UniformsLib,
  UniformsUtils, Vector2, Vector3,
} from 'three';
import { smoothstep } from '../../../core/math2d';
import type { Rng } from '../../../core/rng';
import { addScaled, type FxFrame } from '../fx-frame';
import { HAZE_FRAG, HAZE_VERT } from './haze-cards.glsl';

/** wrap square side (m) and base card size (m) */
const SPAN = 60;
const SIZE = 8.5;
/** PM2.5 colour: sunlit khaki-brown (sRGB → linear) */
const SMOG = new Color('#c4a573');

/**
 * Drifting yellow-grey smog banks near the ground (one draw call). Invisible on clear days; they thicken with the
 * haze (base smog days, spikes) and drift with the wind.
 */
export class HazeCards {
  readonly mesh: Mesh;
  private readonly geometry = new InstancedBufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly color = new Color();
  private readonly drift = new Vector2();

  constructor(private readonly capacity: number, rng: Rng) {
    const count = capacity;
    const quad = new PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) seeds[i] = rng.next();
    this.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
    this.geometry.instanceCount = count;
    this.material = new ShaderMaterial({
      name: 'Weather_Smog', vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG, transparent: true, depthWrite: false,
      fog: true,
      uniforms: UniformsUtils.merge([UniformsLib.fog, {
        uCenter: { value: new Vector3() }, uSpan: { value: SPAN }, uDrift: { value: this.drift }, uSize: { value: SIZE },
        uColor: { value: this.color }, uOpacity: { value: 0 }, uTime: { value: 0 },
      }]),
    });
    this.material.uniforms.uColor.value = this.color;
    this.material.uniforms.uDrift.value = this.drift;
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'weather_smog';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
    this.mesh.visible = false;
  }

  /** live instance budget ≤ capacity */
  setCount(n: number): void {
    this.geometry.instanceCount = Math.max(0, Math.min(this.capacity, n));
  }

  update(f: FxFrame): void {
    const k = smoothstep(0.22, 0.9, f.state.haze);
    this.mesh.visible = k > 0.01 && this.geometry.instanceCount > 0;
    if (!this.mesh.visible) return;
    const u = this.material.uniforms;
    (u.uCenter.value as Vector3).set(f.focus.x + f.ahead.x * 12, f.groundHeight(f.focus.x, f.focus.z), f.focus.z + f.ahead.z * 12);
    this.drift.set((this.drift.x + f.wind.x * 0.6 * f.dt) % SPAN, (this.drift.y + f.wind.z * 0.6 * f.dt) % SPAN);
    u.uTime.value = f.time % 1000;
    u.uOpacity.value = 0.95 * k;
    const l = f.light;
    // lit smog, melted into the fog colour so the banks read as local thickening of the same air
    addScaled(this.color.copy(l.ambient), l.sun, 0.6).multiply(SMOG).lerp(l.fog, 0.2);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
