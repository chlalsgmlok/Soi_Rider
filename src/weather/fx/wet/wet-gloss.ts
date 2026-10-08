import { type Material, type Object3D, type WebGLProgramParametersWithUniforms, type WebGLRenderer, Uniform } from 'three';
import { isMesh, isStandardMaterial } from '../../../engine/assets/material-guards';

const ANCHOR = '#include <lights_physical_fragment>';
/** after the light loops: the water film's extra sky reflection goes in here */
const SHEEN_ANCHOR = '#include <aomap_fragment>';

/**
 * Wet surfaces in the lighting stage (after every module's own roughness logic): up-facing surfaces catch the most
 * water; smooth ones (paint, plastic, glass) gain a glossy film — sharper and stronger sky/lamp reflections and a
 * deeper colour — porous ones (cloth, hair, skin) soak and darken.
 */
const WET_CHUNK = /* glsl */ `
vec3 wetGlossN = transformDirectionByInverseViewMatrix( normal, viewMatrix );
float wetGlossK = uWetGloss * ( 0.55 + 0.45 * saturate( wetGlossN.y ) );
float wetGlossPorous = smoothstep( 0.5, 0.95, roughnessFactor );
diffuseColor.rgb *= 1.0 - wetGlossK * ( 0.3 * wetGlossPorous + 0.12 * ( 1.0 - wetGlossPorous ) );
roughnessFactor = mix( roughnessFactor, min( roughnessFactor, 0.08 + 0.32 * wetGlossPorous ), wetGlossK );
${ANCHOR}`;

const SHEEN_CHUNK = /* glsl */ `
reflectedLight.indirectSpecular *= 1.0 + 1.6 * wetGlossK * ( 1.0 - wetGlossPorous );
${SHEEN_ANCHOR}`;

type Compile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void;

interface Original {
  compile: Compile;
  key: () => string;
}

/**
 * "Paint glossiness up when wet": patches standard materials (NPC rig material, the rider's bike and gear …) with
 * one shared wetness uniform. Chains the material's existing onBeforeCompile (toon shading, rig tints) and gives
 * the patched program its own cache key. `dispose()` restores the originals.
 */
export class WetGloss {
  readonly uniform = new Uniform(0);
  private readonly originals = new Map<Material, Original>();
  private warned = false;

  /** patch every standard material under `root` (idempotent; call again after swapping models) */
  add(root: Object3D): number {
    let n = 0;
    root.traverse((o) => {
      if (!isMesh(o)) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (this.patch(m)) n++;
    });
    return n;
  }

  /** 0..1 how wet the patched surfaces look */
  set(wet: number): void {
    this.uniform.value = wet;
  }

  dispose(): void {
    for (const [m, o] of this.originals) {
      m.onBeforeCompile = o.compile;
      m.customProgramCacheKey = o.key;
      m.needsUpdate = true;
    }
    this.originals.clear();
    this.uniform.value = 0;
  }

  private patch(m: Material): boolean {
    if (!isStandardMaterial(m) || this.originals.has(m)) return false;
    const compile: Compile = m.onBeforeCompile.bind(m);
    const key = m.customProgramCacheKey.bind(m);
    this.originals.set(m, { compile: m.onBeforeCompile, key: m.customProgramCacheKey });
    m.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer);
      if (!shader.fragmentShader.includes(ANCHOR)) {
        if (!this.warned) console.warn(`[weather] wet gloss: ${ANCHOR} missing in ${m.name}`);
        this.warned = true;
        return;
      }
      shader.uniforms.uWetGloss = this.uniform;
      const lit = shader.fragmentShader.replace(ANCHOR, WET_CHUNK);
      shader.fragmentShader = `uniform float uWetGloss;\n${lit.includes(SHEEN_ANCHOR) ? lit.replace(SHEEN_ANCHOR, SHEEN_CHUNK) : lit}`;
    };
    m.customProgramCacheKey = () => `${key()}|wet-2`;
    m.needsUpdate = true;
    return true;
  }
}
