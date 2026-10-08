import {
  Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, UniformsLib,
  UniformsUtils, Vector3,
} from 'three';
import { clamp } from '../../../core/math2d';
import type { Rng } from '../../../core/rng';
import { addScaled, type FxFrame } from '../fx-frame';
import { RAIN_FRAG, RAIN_VERT } from './rain-streaks.glsl';

/** m/s terminal velocity of a big tropical raindrop */
const FALL = 9.5;
/** shutter time → streak length (≈ speed × exposure) */
const EXPOSURE = 0.1;
/** world width of a streak (m); far drops are held at ≥ MIN_PX pixels and fade instead */
const WIDTH = 0.018;
const MIN_PX = 1.4;
/** the FX clock wraps so the lattice stays float-precise in long sessions */
const TIME_WRAP = 512;
const center = new Vector3();
const flat = new Vector3();
/** at night rain catches the city's glow: a cool grey sheen, warmed a little by the lamps */
const CITY_GLOW = new Color('#3a4150');

/**
 * GPU rain: `capacity` instanced streak quads animated entirely in the vertex shader (one draw call). The visible
 * share follows the rain intensity; the volume follows the camera (sized to its height so the diorama view and the
 * POV both fill their frustum).
 */
export class RainStreaks {
  readonly mesh: Mesh;
  private geometry = new InstancedBufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly color = new Color();
  private capacity = 0;

  constructor(capacity: number, private readonly rng: Rng) {
    this.material = new ShaderMaterial({
      name: 'Weather_Rain', vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false,
      fog: true, side: DoubleSide,
      uniforms: UniformsUtils.merge([UniformsLib.fog, {
        uTime: { value: 0 }, uCenter: { value: new Vector3() }, uBox: { value: new Vector3(30, 16, 30) },
        uVel: { value: new Vector3(0, -FALL, 0) }, uCamVel: { value: new Vector3() }, uStreak: { value: EXPOSURE },
        uWidth: { value: WIDTH }, uPx: { value: 0.002 }, uRain: { value: 0 }, uColor: { value: this.color },
        uOpacity: { value: 0.3 },
      }]),
    });
    this.material.uniforms.uColor.value = this.color;
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'weather_rain';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.visible = false;
    this.setCapacity(capacity);
  }

  /** (re)build the drop lattice for a quality budget (a fresh geometry; the old one's GPU buffers are freed) */
  setCapacity(n: number): void {
    if (n === this.capacity) return;
    this.capacity = n;
    const old = this.geometry;
    const quad = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.geometry = new InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) seeds[i] = this.rng.next();
    this.geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
    this.geometry.instanceCount = n;
    this.mesh.geometry = this.geometry;
    old.dispose();
  }

  update(f: FxFrame): void {
    const rain = f.state.rain;
    this.mesh.visible = rain > 0.004 && this.capacity > 0;
    if (!this.mesh.visible) return;
    const u = this.material.uniforms;
    // a box sized to the camera height, pushed ahead along the view so the drops fill the frustum
    const ground = f.groundHeight(f.camPos.x, f.camPos.z);
    const height = Math.max(1.2, f.camPos.y - ground);
    const side = clamp(height * 2.6, 24, 38);
    const box = u.uBox.value as Vector3;
    box.set(side, height + 6, side);
    flat.set(f.camDir.x, 0, f.camDir.z);
    if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1);
    flat.normalize();
    center.set(f.camPos.x + flat.x * side * 0.42, ground - 1 + box.y / 2, f.camPos.z + flat.z * side * 0.42);
    (u.uCenter.value as Vector3).copy(center);
    (u.uVel.value as Vector3).set(f.wind.x, -FALL, f.wind.z);
    (u.uCamVel.value as Vector3).copy(f.camVel);
    u.uTime.value = f.time % TIME_WRAP;
    // drizzle = a few fat drops; a downpour fills the lattice
    u.uRain.value = clamp(0.06 + rain * 1.05, 0, 1) * (rain > 0.004 ? 1 : 0);
    u.uPx.value = MIN_PX / f.pxPerUnit;
    const l = f.light;
    u.uOpacity.value = (0.26 + 0.22 * rain) * (1 - 0.3 * l.night);
    addScaled(addScaled(addScaled(this.color.copy(l.ambient).multiplyScalar(1.7), l.sun, 0.45), l.lampGlow, 0.6), CITY_GLOW, l.night);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
