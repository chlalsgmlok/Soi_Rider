import { FrontSide, MeshStandardMaterial } from 'three';
import { toonify } from '../../../engine/env/toonify';
import { GROUND_BEGIN_VERTEX, GROUND_FRAG_PARS, GROUND_PATTERN, GROUND_ROUGHNESS, GROUND_VERT_PARS } from './ground-shader';

/** Toon-shaded ground (roads, sidewalks, curbs, lots) with world-space patterns and a live wetness uniform. */
export class GroundMaterial {
  readonly material: MeshStandardMaterial;
  private readonly wet = { value: 0 };

  constructor() {
    const m = new MeshStandardMaterial({ name: 'City_Ground', vertexColors: true, side: FrontSide, roughness: 1, metalness: 0 });
    toonify(m);
    const toon = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      toon.call(m, shader, renderer);
      shader.uniforms.uGWet = this.wet;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${GROUND_VERT_PARS}`)
        .replace('#include <begin_vertex>', GROUND_BEGIN_VERTEX);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${GROUND_FRAG_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${GROUND_PATTERN}`)
        .replace('#include <roughnessmap_fragment>', GROUND_ROUGHNESS);
    };
    m.customProgramCacheKey = () => 'soi-city-ground-1';
    this.material = m;
  }

  /** 0..1 road wetness */
  setWet(w: number): void {
    this.wet.value = w;
  }

  dispose(): void {
    this.material.dispose();
  }
}
