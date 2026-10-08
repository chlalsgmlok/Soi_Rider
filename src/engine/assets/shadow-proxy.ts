import { type BufferGeometry, DoubleSide, FrontSide, Mesh, ShaderMaterial, type Side } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Main-pass shader of a shadow proxy: every vertex lands outside the clip volume, so the colour pass costs one
 * draw and zero fragments. The shadow pass ignores this material (three renders casters with its depth material),
 * so the proxy still writes the full static silhouette into the shadow map — in ONE draw instead of hundreds.
 * (Layers can't do this: WebGLShadowMap tests object layers against the MAIN camera.)
 */
const VERT = 'void main() { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }';
const FRAG = 'void main() { gl_FragColor = vec4(0.0); }';

const materials = new Map<Side, ShaderMaterial>();

function proxyMaterial(side: Side): ShaderMaterial {
  let m = materials.get(side);
  if (!m) {
    m = new ShaderMaterial({ name: 'ShadowProxy', vertexShader: VERT, fragmentShader: FRAG, side, depthWrite: false });
    materials.set(side, m);
  }
  return m;
}

export interface CasterCell {
  side: Side;
  geoms: BufferGeometry[];
}

/**
 * Shadow-casting proxies, one per (grid cell × face mode): single-sided geometry keeps three's back-face shadow
 * rendering, double-sided planes (awnings) cast from both sides, and the grid keeps per-cell frustum culling in the
 * shadow pass. Geometries are position-only, world-space, indexed.
 */
export function buildShadowProxies(cells: Iterable<CasterCell>, name: string): Mesh[] {
  const out: Mesh[] = [];
  for (const { side, geoms } of cells) {
    if (!geoms.length) continue;
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
    if (!merged) {
      console.warn(`[shadowProxy] could not merge ${geoms.length} caster geometries`);
      continue;
    }
    merged.computeBoundingSphere();
    const mesh = new Mesh(merged, proxyMaterial(side === DoubleSide ? DoubleSide : FrontSide));
    mesh.name = `${name}_shadow_${out.length}`;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.userData.shadowProxy = true;
    out.push(mesh);
  }
  return out;
}
