import {
  AdditiveBlending, Color, type ColorRepresentation, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial,
  UniformsLib, UniformsUtils, Vector3,
} from 'three';

const VERT = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vUv = uv * 2.0 - 1.0;
  vTint = vec3(1.0);
#ifdef USE_INSTANCING_COLOR
  vTint = instanceColor;
#endif
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  vec4 mvPosition = modelViewMatrix * p;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float d = dot(vUv, vUv);
  float f = max(0.0, 1.0 - d);
  // bright core + long soft tail, like a sodium/LED lamp spill on asphalt
  vec3 col = vTint * uIntensity * (f * f * 0.75 + f * f * f * f * 1.6);
#ifdef USE_FOG
  #ifdef FOG_EXP2
  float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
  float fogF = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  col *= 1.0 - fogF;
#endif
  gl_FragColor = vec4(col, 1.0);
}
`;

const m4 = new Matrix4();
const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const pos = new Vector3();
const scl = new Vector3();
const col = new Color();

/**
 * Fake light pools: additive radial glows laid on the ground under street lamps, shop fronts and signs.
 * One draw call for all of them and no per-fragment light loop in the scene's materials — the cheap stand-in
 * for dozens of PointLights at night. Drive `intensity` with `Environment.lampsOn`.
 */
export class LightPools {
  readonly mesh: InstancedMesh;
  private readonly material: ShaderMaterial;
  private used = 0;

  constructor(readonly capacity = 128) {
    this.material = new ShaderMaterial({
      name: 'LightPools',
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uIntensity: { value: 0 } }]),
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new InstancedMesh(new PlaneGeometry(2, 2), this.material, capacity);
    this.mesh.name = 'light_pools';
    this.mesh.count = 0;
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** overall strength (0 hides the mesh entirely — no cost by day) */
  set intensity(v: number) {
    this.material.uniforms.uIntensity.value = v;
    this.mesh.visible = v > 0.002 && this.used > 0;
  }

  get intensity(): number {
    return this.material.uniforms.uIntensity.value as number;
  }

  /** add a pool centred at `at` (y = surface height) with the given radius (m); returns its index or −1 when full */
  add(at: Vector3, radius: number, color: ColorRepresentation, strength = 1): number {
    if (this.used >= this.capacity) return -1;
    const i = this.used++;
    m4.compose(pos.set(at.x, at.y + 0.02, at.z), flat, scl.set(radius, radius, 1));
    this.mesh.setMatrixAt(i, m4);
    this.mesh.setColorAt(i, col.set(color).multiplyScalar(strength));
    this.mesh.count = this.used;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.intensity = this.intensity;
    return i;
  }

  clear(): void {
    this.used = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
