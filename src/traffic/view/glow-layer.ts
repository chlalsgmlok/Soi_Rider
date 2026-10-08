import {
  AdditiveBlending, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry,
  ShaderMaterial,
} from 'three';

const FLARE_VERT = /* glsl */ `
attribute vec4 iGlow;
varying vec3 vColor;
varying vec2 vUv;
varying float vFade;
uniform vec2 uFade;
void main() {
  vUv = uv;
  vColor = iGlow.rgb;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xyz += normalize(-mv.xyz) * 0.35;
  mv.xy += position.xy * iGlow.w;
  vFade = 1.0 - smoothstep(uFade.x, uFade.y, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FLARE_FRAG = /* glsl */ `
varying vec3 vColor;
varying vec2 vUv;
varying float vFade;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = (exp(-r * r * 10.0) + 0.3 * exp(-r * r * 2.6)) * (1.0 - smoothstep(0.82, 1.0, r)) * vFade;
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

const POOL_VERT = /* glsl */ `
attribute vec4 iGlow;
varying vec3 vColor;
varying vec2 vUv;
varying float vFade;
uniform vec2 uFade;
void main() {
  vUv = uv;
  vColor = iGlow.rgb;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vFade = 1.0 - smoothstep(uFade.x, uFade.y, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

/** headlight fan on the asphalt: bright at the bumper, widening and fading with distance */
const POOL_FRAG = /* glsl */ `
varying vec3 vColor;
varying vec2 vUv;
varying float vFade;
void main() {
  float y = 1.0 - vUv.y;
  float w = 0.22 + 0.78 * y;
  float x = (vUv.x - 0.5) * 2.0 / w;
  float a = pow(1.0 - y, 1.6) * exp(-x * x * 2.2) * smoothstep(0.0, 0.08, y) * vFade;
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

function layer(vert: string, frag: string, capacity: number, name: string): { mesh: InstancedMesh; glow: InstancedBufferAttribute } {
  const g = new PlaneGeometry(1, 1);
  if (name === 'npc_light_pools') {
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 0.5);
  }
  const glow = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  glow.setUsage(DynamicDrawUsage);
  g.setAttribute('iGlow', glow);
  const mat = new ShaderMaterial({
    name, vertexShader: vert, fragmentShader: frag, uniforms: { uFade: { value: [70, 190] } },
    transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
  });
  const mesh = new InstancedMesh(g, mat, capacity);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.renderOrder = 2;
  mesh.count = 0;
  return { mesh, glow };
}

const t = new Matrix4();

function upload(l: { mesh: InstancedMesh; glow: InstancedBufferAttribute }, n: number): void {
  l.mesh.count = n;
  l.mesh.visible = n > 0;
  l.mesh.instanceMatrix.clearUpdateRanges();
  l.mesh.instanceMatrix.addUpdateRange(0, n * 16);
  l.mesh.instanceMatrix.needsUpdate = n > 0;
  l.glow.clearUpdateRanges();
  l.glow.addUpdateRange(0, n * 4);
  l.glow.needsUpdate = n > 0;
}

/**
 * Cheap night lighting for NPC vehicles without real lights: camera-facing lamp flares (head, tail, brake,
 * indicators, taxi roof signs) and headlight fans on the road, both additive instanced quads (two draw calls).
 */
export class GlowLayer {
  readonly root = new Group();
  private readonly flares: { mesh: InstancedMesh; glow: InstancedBufferAttribute };
  private readonly pools: { mesh: InstancedMesh; glow: InstancedBufferAttribute };
  private nf = 0;
  private np = 0;

  constructor(readonly flareCapacity = 1600, readonly poolCapacity = 320) {
    this.flares = layer(FLARE_VERT, FLARE_FRAG, flareCapacity, 'npc_lamp_flares');
    this.pools = layer(POOL_VERT, POOL_FRAG, poolCapacity, 'npc_light_pools');
    this.root.name = 'npc_glow';
    this.root.add(this.flares.mesh, this.pools.mesh);
  }

  begin(): void {
    this.nf = 0;
    this.np = 0;
  }

  /** a lamp flare of `size` metres at a world point, colour already × intensity (linear) */
  flare(x: number, y: number, z: number, r: number, g: number, b: number, size: number): void {
    if (this.nf >= this.flareCapacity || r + g + b < 0.01) return;
    this.flares.mesh.setMatrixAt(this.nf, t.makeTranslation(x, y, z));
    this.flares.glow.setXYZW(this.nf++, r, g, b, size);
  }

  /** a headlight fan: `m` places the unit quad (x = width, z = length forward, origin at the bumper) */
  pool(m: Matrix4, r: number, g: number, b: number): void {
    if (this.np >= this.poolCapacity || r + g + b < 0.01) return;
    this.pools.mesh.setMatrixAt(this.np, m);
    this.pools.glow.setXYZW(this.np++, r, g, b, 0);
  }

  commit(): void {
    upload(this.flares, this.nf);
    upload(this.pools, this.np);
  }

  dispose(): void {
    for (const l of [this.flares, this.pools]) {
      l.mesh.geometry.dispose();
      (l.mesh.material as ShaderMaterial).dispose();
      l.mesh.dispose();
    }
    this.root.removeFromParent();
  }
}
