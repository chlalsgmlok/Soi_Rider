import {
  AdditiveBlending, AmbientLight, BackSide, Color, Group, LessEqualDepth, Mesh, ShaderMaterial, SphereGeometry, Vector3,
} from 'three';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

/** the cloud deck lit from inside: brightest around the strike, broken up by cloud noise */
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFlash;
uniform vec3 uBolt;
uniform float uSeed;
varying vec3 vDir;
float fHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float fNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), u.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec3 d = normalize(vDir);
  float up = smoothstep(-0.03, 0.2, d.y);
  vec2 cuv = d.xz / (d.y + 0.15) * 1.3 + uSeed;
  float cloud = 0.55 * fNoise(cuv * 1.7) + 0.3 * fNoise(cuv * 3.9 + 5.0) + 0.15 * fNoise(cuv * 8.0 + 2.0);
  float near = pow(max(dot(d, uBolt), 0.0), 5.0);
  float k = uFlash * up * (0.25 + 0.75 * smoothstep(0.3, 0.75, cloud)) * (0.35 + 2.4 * near);
  gl_FragColor = vec4(uColor * k, 1.0);
}`;

const FLASH = new Color('#c9d3ff');
const v = new Vector3();

/**
 * Lightning: the sky behind the city flares (an additive far-plane dome that only touches sky pixels, so
 * buildings stay silhouetted) and a cool ambient pulse lights the street. Driven by WeatherState.lightning.
 */
export class SkyFlash {
  readonly root = new Group();
  private readonly geometry = new SphereGeometry(1, 24, 12);
  private readonly material: ShaderMaterial;
  private readonly dome: Mesh;
  private readonly ambient = new AmbientLight(FLASH, 0);

  constructor() {
    this.material = new ShaderMaterial({
      name: 'Weather_SkyFlash', vertexShader: VERT, fragmentShader: FRAG, side: BackSide, transparent: true,
      depthWrite: false, depthTest: true, depthFunc: LessEqualDepth, blending: AdditiveBlending, fog: false,
      uniforms: {
        uColor: { value: FLASH.clone() }, uFlash: { value: 0 }, uBolt: { value: new Vector3(0, 0.3, 1).normalize() },
        uSeed: { value: 0 },
      },
    });
    this.dome = new Mesh(this.geometry, this.material);
    this.dome.name = 'weather_sky_flash';
    this.dome.frustumCulled = false;
    this.dome.renderOrder = 10001;
    this.dome.scale.setScalar(100);
    this.dome.visible = false;
    this.dome.onBeforeRender = (_r, _s, camera) => {
      this.dome.position.setFromMatrixPosition(camera.matrixWorld);
      this.dome.updateMatrixWorld();
    };
    this.ambient.name = 'weather_lightning';
    this.root.add(this.dome, this.ambient);
  }

  /** a new strike: aim the glow at a random patch of sky (`azimuth` radians, sim heading convention) */
  aim(azimuth: number, seed: number): void {
    (this.material.uniforms.uBolt.value as Vector3).copy(v.set(Math.sin(azimuth), 0.28, Math.cos(azimuth)).normalize());
    this.material.uniforms.uSeed.value = seed * 17.3;
  }

  /** `flash` 0..1 brightness now, `darkness` 0..1 (a flash reads far stronger at dusk/night) */
  update(flash: number, darkness: number): void {
    const k = flash * (0.45 + 0.55 * darkness);
    this.dome.visible = k > 0.003;
    this.material.uniforms.uFlash.value = 1.6 * k;
    this.ambient.intensity = 2.4 * k;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.ambient.dispose();
  }
}
