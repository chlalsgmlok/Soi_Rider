import {
  AdditiveBlending, type BufferAttribute, DoubleSide, Group, type InstancedBufferAttribute, InstancedMesh, type Object3D,
  PlaneGeometry, ShaderMaterial, UniformsLib, UniformsUtils,
} from 'three';
import { isInstancedMesh } from '../../../engine/assets/material-guards';
import { REFLECT_FRAG, REFLECT_VERT } from './wet-reflections.glsl';

interface Layer {
  readonly mesh: InstancedMesh;
  readonly src: InstancedMesh;
  readonly material: ShaderMaterial;
  readonly ownMatrix: InstancedBufferAttribute;
  readonly shared: readonly string[];
  /** extra strength factor of the source right now (city pools follow their night intensity) */
  readonly gain: () => number;
  readonly scale: number;
}

/** streak length multipliers: lamp flares on vehicles / broad city light pools */
const STRETCH = { flares: 1.25, pools: 0.85 } as const;

function findInstanced(root: Object3D, name: string): InstancedMesh | null {
  const o = root.getObjectByName(name);
  return o && isInstancedMesh(o) ? (o as InstancedMesh) : null;
}

/**
 * Reflections of lights on the wet road (mockup 02's red tail-light and neon streaks). Each layer re-draws an
 * existing instanced light source (NPC lamp flares, city light pools) as ground streaks aimed at the camera,
 * SHARING its instance buffers — no extra uploads, one additive draw call per source.
 */
export class WetReflections {
  readonly root = new Group();
  private readonly layers: Layer[] = [];

  constructor() {
    this.root.name = 'weather_wet_reflections';
  }

  /** NPC lamp flares (TrafficView glow layer, mesh 'npc_lamp_flares'); false when the source is missing */
  addFlares(trafficRoot: Object3D): boolean {
    const src = findInstanced(trafficRoot, 'npc_lamp_flares');
    if (!src?.geometry.getAttribute('iGlow')) return false;
    this.add(src, ['iGlow'], { FLARES: 1 }, () => 1, 1.1, STRETCH.flares);
    return true;
  }

  /** city light pools (CityView 'city_light_pools'): street lamps, shop fronts, minimarts, sign spill */
  addPools(cityRoot: Object3D): boolean {
    const src = findInstanced(cityRoot, 'city_light_pools');
    if (!src) return false;
    const m = src.material as ShaderMaterial;
    const gain = (): number => {
      const u = m.isShaderMaterial ? m.uniforms.uIntensity : undefined;
      return src.visible && u && typeof u.value === 'number' ? u.value : 0;
    };
    this.add(src, [], {}, gain, 0.9, STRETCH.pools);
    return true;
  }

  /** `wet` 0..1 road wetness */
  update(wet: number): void {
    for (const l of this.layers) {
      const k = wet * l.scale * l.gain();
      l.material.uniforms.uStrength.value = k;
      l.mesh.visible = k > 0.004 && l.src.count > 0;
      if (l.mesh.visible) l.mesh.matrixWorld.copy(l.src.matrixWorld);
    }
  }

  dispose(): void {
    for (const l of this.layers) {
      // hand the shared buffers back before disposing, so the source keeps its GPU data
      for (const name of l.shared) l.mesh.geometry.deleteAttribute(name);
      l.mesh.instanceMatrix = l.ownMatrix;
      l.mesh.instanceColor = null;
      l.mesh.geometry.dispose();
      l.material.dispose();
      l.mesh.dispose();
    }
    this.layers.length = 0;
    this.root.removeFromParent();
  }

  private add(src: InstancedMesh, shared: string[], defines: Record<string, number>, gain: () => number, scale: number, stretch: number): void {
    const geo = new PlaneGeometry(1, 1.3).translate(0, 0.35, 0);
    for (const name of shared) geo.setAttribute(name, src.geometry.getAttribute(name) as BufferAttribute);
    const material = new ShaderMaterial({
      name: 'Weather_WetReflections', vertexShader: REFLECT_VERT, fragmentShader: REFLECT_FRAG, defines,
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uStrength: { value: 0 }, uStretch: { value: stretch } }]),
      transparent: true, depthWrite: false, blending: AdditiveBlending, fog: true, side: DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -6,
    });
    const mesh = new InstancedMesh(geo, material, 1);
    const ownMatrix = mesh.instanceMatrix;
    mesh.instanceMatrix = src.instanceMatrix;
    mesh.instanceColor = src.instanceColor;
    mesh.name = `wet_reflect_${src.name}`;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    mesh.renderOrder = 3;
    mesh.visible = false;
    // the source re-uploads every frame: draw exactly what it draws
    mesh.onBeforeRender = () => {
      mesh.count = src.count;
    };
    this.root.add(mesh);
    this.layers.push({ mesh, src, material, ownMatrix, shared, gain, scale });
  }
}
