import { DoubleSide, MeshStandardMaterial, type Texture } from 'three';
import { toonify } from '../../../engine/env/toonify';

const VERT_PARS = /* glsl */ `
attribute float aGlow;
varying float vSGlow;
`;
const FRAG_PARS = /* glsl */ `
uniform float uSignBox;
uniform float uSignNeon;
uniform float uSignPlate;
varying float vSGlow;
`;
/** artwork over the board colour: ink cells are transparent around the lettering */
const MAP = /* glsl */ `
vec4 sTex = texture2D( map, vMapUv );
diffuseColor.rgb = mix( vColor.rgb, sTex.rgb, sTex.a );
`;
/** lightboxes glow whole, neon only along the tubes, plates just catch a little light */
const EMISSIVE = /* glsl */ `
if ( vSGlow < 0.5 ) totalEmissiveRadiance = diffuseColor.rgb * uSignBox;
else if ( vSGlow < 1.5 ) totalEmissiveRadiance = sTex.rgb * sTex.a * uSignNeon + vColor.rgb * 0.03;
else totalEmissiveRadiance = diffuseColor.rgb * uSignPlate;
`;

/** Sign material: per-city atlas over vertex-coloured boards, glowing by time of day. */
export class SignMaterial {
  readonly material: MeshStandardMaterial;
  private readonly box = { value: 0 };
  private readonly neon = { value: 0.3 };
  private readonly plate = { value: 0 };

  constructor(atlas: Texture) {
    const m = new MeshStandardMaterial({ name: 'City_Signs', map: atlas, vertexColors: true, side: DoubleSide, roughness: 0.5, metalness: 0 });
    toonify(m);
    const toon = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      toon.call(m, shader, renderer);
      shader.uniforms.uSignBox = this.box;
      shader.uniforms.uSignNeon = this.neon;
      shader.uniforms.uSignPlate = this.plate;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSGlow = aGlow;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
        .replace('#include <map_fragment>', MAP)
        .replace('#include <color_fragment>', '')
        .replace('#include <emissivemap_fragment>', EMISSIVE);
    };
    m.customProgramCacheKey = () => 'soi-city-sign-1';
    this.material = m;
  }

  /** lamps 0..1 (Environment.lampsOn) */
  setLamps(lamps: number): void {
    this.box.value = 0.08 + 1.35 * lamps;
    this.neon.value = 0.35 + 2.8 * lamps;
    this.plate.value = 0.12 * lamps;
  }

  dispose(): void {
    this.material.dispose();
  }
}
