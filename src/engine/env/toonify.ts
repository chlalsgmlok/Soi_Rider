import { type Material, ShaderChunk, Uniform } from 'three';
import { isStandardMaterial } from '../assets/material-guards';

/**
 * Stylised "toy diorama" shading for MeshStandardMaterial (and Physical): direct light N·L goes through a soft
 * 3-band ramp (core shadow / half-tone / lit) blended with plain Lambert, plus a warm light-coloured rim on the
 * light-facing silhouette. Shadows, IBL and speculars are untouched, so the cost equals a stock standard material
 * and every toonified material shares ONE shader program.
 */
const DOTNL = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';

/**
 * Shared, live-tunable toon controls (one Uniform object referenced by every toonified material — changing a value
 * needs no recompile). `band`: 0 = plain Lambert … 1 = fully banded; `rim`: warm rim strength vs the direct light.
 */
export const TOON = {
  band: new Uniform(0.55),
  rim: new Uniform(0.16),
};

const TOON_FUNCS = /* glsl */ `
uniform float uToonBand;
uniform float uToonRim;
float toonRamp( const in float ndl ) {
  float t1 = smoothstep( -0.04, 0.16, ndl );
  float t2 = smoothstep( 0.38, 0.6, ndl );
  float banded = 0.6 * t1 + 0.4 * t2;
  return mix( saturate( ndl ), banded, uToonBand );
}
float toonRim( const in vec3 n, const in vec3 v, const in vec3 l ) {
  float fres = pow( 1.0 - saturate( dot( n, v ) ), 3.0 );
  float facing = saturate( dot( n, l ) * 0.6 + 0.4 );
  return fres * facing * uToonRim;
}
`;

let patchedChunk: string | null = null;

function toonChunk(): string {
  if (patchedChunk !== null) return patchedChunk;
  const src = ShaderChunk.lights_physical_pars_fragment;
  if (!src.includes(DOTNL)) {
    console.warn('[toonify] lights_physical_pars_fragment changed — toon ramp disabled');
    patchedChunk = src;
    return src;
  }
  const replaced = src.replace(
    DOTNL,
    'float dotNL = toonRamp( dot( geometryNormal, directLight.direction ) );\n' +
      '\treflectedLight.directDiffuse += directLight.color * material.diffuseColor *' +
      ' toonRim( geometryNormal, geometryViewDir, directLight.direction );',
  );
  patchedChunk = TOON_FUNCS + replaced;
  return patchedChunk;
}

const PROGRAM_KEY = 'soi-toon-2';
/** WeakSet, not userData: Material.clone() copies userData but not onBeforeCompile */
const patched = new WeakSet<Material>();

export function isToonified(material: Material): boolean {
  return patched.has(material);
}

/** patch in place (idempotent). Non-standard materials are left alone. Returns the same material. */
export function toonify<T extends Material>(material: T): T {
  if (!isStandardMaterial(material) || isToonified(material)) return material;
  patched.add(material);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uToonBand = TOON.band;
    shader.uniforms.uToonRim = TOON.rim;
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_pars_fragment>', toonChunk());
  };
  material.customProgramCacheKey = () => PROGRAM_KEY;
  material.needsUpdate = true;
  return material;
}
