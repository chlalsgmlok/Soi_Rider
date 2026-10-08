import { Color, DoubleSide, MeshStandardMaterial, Vector3, Vector4 } from 'three';
import { toonify } from '../../../engine/env/toonify';
import {
  CITY_BEGIN_VERTEX, CITY_COLOR_VERTEX, CITY_EMISSIVE, CITY_FADE, CITY_FRAG_PARS, CITY_LIGHTS_END, CITY_METALNESS,
  CITY_PROJECT_VERTEX, CITY_ROUGHNESS, CITY_VERT_PARS,
} from './city-shader';
import { EMIS } from './material-rules';

export const PALETTE_SIZE = 64;

/** warm sodium-ish glow of lit apartment windows */
const WINDOW_GLOW = new Color('#ffc98a');
/** screen radius (NDC height units) around the rider inside which cables / foliage in front of them dissolve */
const FOCUS_RADIUS = 0.16;
/** the rider's torso height used as the focus point (m) */
const FOCUS_HEIGHT = 1.0;

export interface CityLight {
  /** 0..1 street lamps / neon / lit windows (Environment.lampsOn) */
  lamps: number;
  /** 0..1 darkness (Environment.night) */
  night: number;
  /** seconds (sway, blinking aviation lamps) */
  time: number;
}

/**
 * The single toon-shaded material of the city batch: vertex colours + per-vertex PBR response, per-instance palette
 * tints, roller shutters, foliage sway and time-of-day emissive classes (windows, shop interiors, lamps, neon, …).
 * One shader program for every building, prop, wire and fence in the city.
 */
export class CityMaterial {
  readonly material: MeshStandardMaterial;
  private readonly palette = { value: Array.from({ length: PALETTE_SIZE }, () => new Color(1, 1, 1)) };
  private readonly emis = { value: Array.from({ length: 8 }, () => new Vector3()) };
  private readonly time = { value: 0 };
  private readonly shutter = { value: [2.75, 1.8] as [number, number] };
  private readonly focus = { value: new Vector4(0, 0, 0, 0) };

  constructor() {
    const m = new MeshStandardMaterial({ name: 'City_Uber', vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0 });
    toonify(m);
    const toon = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      toon.call(m, shader, renderer);
      shader.uniforms.uCityPalette = this.palette;
      shader.uniforms.uCityEmis = this.emis;
      shader.uniforms.uCityTime = this.time;
      shader.uniforms.uCityShutter = this.shutter;
      shader.uniforms.uCityFocus = this.focus;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${CITY_VERT_PARS}`)
        .replace('#include <color_vertex>', CITY_COLOR_VERTEX)
        .replace('#include <begin_vertex>', CITY_BEGIN_VERTEX)
        .replace('#include <project_vertex>', CITY_PROJECT_VERTEX);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${CITY_FRAG_PARS}`)
        .replace('#include <clipping_planes_fragment>', CITY_FADE)
        .replace('#include <roughnessmap_fragment>', CITY_ROUGHNESS)
        .replace('#include <metalnessmap_fragment>', CITY_METALNESS)
        .replace('#include <emissivemap_fragment>', CITY_EMISSIVE)
        .replace('#include <lights_fragment_end>', CITY_LIGHTS_END);
    };
    m.customProgramCacheKey = () => 'soi-city-uber-7';
    this.material = m;
    this.setLight({ lamps: 0, night: 0, time: 0 });
  }

  /** palette colours (sRGB hex) by index; index 0 is reserved for "no tint" */
  setPalette(hexes: readonly string[]): void {
    hexes.forEach((h, i) => {
      if (i > 0 && i < PALETTE_SIZE) this.palette.value[i].set(h);
    });
  }

  /** the rider (ground x/z) whose screen neighbourhood cables and foliage in front of them dissolve from; null = off */
  setFocus(focus: { x: number; z: number } | null | undefined, groundY = 0): void {
    if (focus) this.focus.value.set(focus.x, groundY + FOCUS_HEIGHT, focus.z, FOCUS_RADIUS);
    else this.focus.value.w = 0;
  }

  /** roller-shutter span (top, bottom) authored on the shophouse models */
  setShutter(top: number, bottom: number): void {
    this.shutter.value = [top, bottom];
  }

  setLight({ lamps, night, time }: CityLight): void {
    this.time.value = time;
    const e = this.emis.value;
    const glow = 1.7 * lamps * (0.6 + 0.4 * night);
    e[EMIS.window].set(WINDOW_GLOW.r * glow, WINDOW_GLOW.g * glow, WINDOW_GLOW.b * glow);
    e[EMIS.interior].setScalar(0.95 + 1.9 * lamps);
    e[EMIS.lamp].setScalar(0.3 + 3.2 * lamps);
    e[EMIS.neon].setScalar(0.45 + 2.6 * lamps);
    const blink = (time % 1.6) < 0.55 ? 1 : 0.08;
    e[EMIS.aviation].setScalar((0.4 + 2.6 * lamps) * blink);
    e[EMIS.head].setScalar(1.2 + 3 * lamps);
    e[EMIS.tail].setScalar(0.6 + 2.2 * lamps);
  }

  dispose(): void {
    this.material.dispose();
  }
}
