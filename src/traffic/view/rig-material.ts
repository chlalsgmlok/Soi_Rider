import { DoubleSide, FrontSide, MeshStandardMaterial } from 'three';
import { toonify } from '../../engine/env/toonify';

/**
 * One material for every NPC part (cars, motorbikes, people, attachments): authored colours, roughness and
 * metalness are baked per vertex, per-instance tints recolour Paint / Paint2 / skin / shirt … and per-instance
 * light levels drive brake lamps, indicators and night glow. Toon-shaded like everything else (toonify), so
 * thousands of NPC parts cost a few dozen draw calls and a single shader program.
 *
 * Vertex attributes: color (vec3), aMat (roughness, metalness, tint slot 0..4), aGlow (emissive rgb, channel).
 * Instance attributes: iTintA..iTintD (vec3), iLights (brake, indicator L, indicator R, night).
 */
const VERT_DECL = /* glsl */ `
attribute vec3 aMat;
attribute vec4 aGlow;
attribute vec3 iTintA;
attribute vec3 iTintB;
attribute vec3 iTintC;
attribute vec3 iTintD;
attribute vec4 iLights;
varying vec3 vRigTint;
varying vec3 vRigGlow;
varying vec2 vRigRM;
`;

const VERT_BODY = /* glsl */ `
float rigSlot = aMat.z;
vRigTint = rigSlot < 0.5 ? vec3(1.0) : rigSlot < 1.5 ? iTintA : rigSlot < 2.5 ? iTintB : rigSlot < 3.5 ? iTintC : iTintD;
float rigCh = aGlow.w;
float rigK = rigCh < 0.5 ? 1.0 : rigCh < 1.5 ? iLights.x : rigCh < 2.5 ? iLights.y : rigCh < 3.5 ? iLights.z
  : 0.25 + 2.2 * iLights.w;
vRigGlow = aGlow.rgb * rigK;
vRigRM = aMat.xy;
`;

const FRAG_DECL = /* glsl */ `
varying vec3 vRigTint;
varying vec3 vRigGlow;
varying vec2 vRigRM;
`;

function inject(src: string, anchor: string, code: string): string {
  if (!src.includes(anchor)) {
    console.warn(`[rig-material] shader anchor ${anchor} missing`);
    return src;
  }
  return src.replace(anchor, `${anchor}\n${code}`);
}

export function createRigMaterial(doubleSided = true): MeshStandardMaterial {
  const m = toonify(new MeshStandardMaterial({
    name: 'NPC_Rig', vertexColors: true, roughness: 0.6, metalness: 0, side: doubleSided ? DoubleSide : FrontSide,
  }));
  const toon = m.onBeforeCompile.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    toon(shader, renderer);
    shader.vertexShader = VERT_DECL + inject(shader.vertexShader, '#include <color_vertex>', VERT_BODY);
    let f = FRAG_DECL + shader.fragmentShader;
    f = inject(f, '#include <color_fragment>', 'diffuseColor.rgb *= vRigTint;');
    f = inject(f, '#include <roughnessmap_fragment>', 'roughnessFactor = vRigRM.x;');
    f = inject(f, '#include <metalnessmap_fragment>', 'metalnessFactor = vRigRM.y;');
    f = inject(f, '#include <emissivemap_fragment>', 'totalEmissiveRadiance += vRigGlow;');
    shader.fragmentShader = f;
  };
  m.customProgramCacheKey = () => `soi-toon-2|npc-rig-1|${m.side}`;
  return m;
}

/** dark tinted car glass: lets the driver silhouettes read through it */
export function createGlassMaterial(): MeshStandardMaterial {
  return toonify(new MeshStandardMaterial({
    name: 'NPC_Glass', color: 0x0d1720, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.62,
    depthWrite: false, side: FrontSide, envMapIntensity: 1.4,
  }));
}
