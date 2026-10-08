import { Color, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import { PALETTE } from '../../core/config/palette';

/** half width of the ribbon mesh (m): dash core + chevron arms + glow halo */
export const RIBBON_HALF = 0.85;

const VERT = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vRoute;
void main() {
  vRoute = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

/**
 * Dashes flow toward the target; every few metres a chevron replaces two dashes. Shapes are anti-aliased with
 * screen derivatives, wrapped in a soft glow halo, and faded right under the bike, far ahead and at the very end.
 */
const FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uTime;
uniform float uHead;
uniform float uLength;
uniform float uOpacity;
uniform float uGlow;
uniform vec2 uFar;
varying vec2 vRoute;

const float HALF = ${RIBBON_HALF.toFixed(3)};
const float FLOW = 2.4;
const float PERIOD = 1.9;
const float DASH = 1.05;
const float CORE = 0.1;
const float CELL = 7.6;
const float CHEV_SPAN = 3.8;
const float CHEV_HALF = 0.58;
const float CHEV_SLOPE = 0.95;
const float CHEV_T = 0.13;

void main() {
  float s = vRoute.y;
  float x = abs(vRoute.x) * HALF;
  float flow = s - uTime * FLOW;
  float aaS = fwidth(s) * 1.25 + 0.015;
  float aaX = fwidth(x) * 1.25 + 0.006;

  float ph = mod(flow, PERIOD);
  float dash = smoothstep(0.0, aaS, ph) * (1.0 - smoothstep(DASH - aaS, DASH, ph));
  float dashSoft = smoothstep(-0.35, 0.25, ph) * (1.0 - smoothstep(DASH - 0.25, DASH + 0.35, ph));
  float core = 1.0 - smoothstep(CORE - aaX, CORE + aaX, x);

  float cp = mod(flow, CELL * 2.0);
  float inChev = step(CELL * 2.0 - CHEV_SPAN, cp);
  float v = cp - (CELL * 2.0 - CHEV_SPAN * 0.5) - 0.35;
  float d = abs(v + x * CHEV_SLOPE);
  float arms = 1.0 - smoothstep(CHEV_HALF - aaX, CHEV_HALF + aaX, x);
  float chev = (1.0 - smoothstep(CHEV_T - aaS, CHEV_T + aaS, d)) * arms;
  float chevSoft = (1.0 - smoothstep(CHEV_T, CHEV_T + 0.42, d)) * (1.0 - smoothstep(CHEV_HALF, CHEV_HALF + 0.3, x));

  float shape = mix(dash * core, chev, inChev);
  float halo = mix(dashSoft * exp(-x * x * 14.0), chevSoft * 0.8, inChev) * uGlow;
  float fade = smoothstep(uHead + 0.4, uHead + 4.5, s)
    * (1.0 - smoothstep(uFar.x, uFar.y, s - uHead))
    * (1.0 - smoothstep(uLength - 0.9, uLength, s));
  float alpha = max(shape, halo) * fade * uOpacity;
#ifdef USE_FOG
  #ifdef FOG_EXP2
  float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
  float fogF = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  alpha *= 1.0 - fogF * 0.85;
#endif
  if (alpha < 0.004) discard;
  vec3 col = mix(uColor, uCore, shape * (1.0 - smoothstep(0.0, CORE * 0.8, x) * 0.6));
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

/** gram-cyan ribbon material (docs/DESIGN_SYSTEM.md: the route is the only cyan living in the world) */
export function createRouteMaterial(): ShaderMaterial {
  const core = new Color(PALETTE.gramCyan).lerp(new Color('#ffffff'), 0.28);
  return new ShaderMaterial({
    name: 'gram_route',
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uColor: { value: new Color(PALETTE.gramCyan) },
      uCore: { value: core },
      uTime: { value: 0 },
      uHead: { value: 0 },
      uLength: { value: 0 },
      uOpacity: { value: 1 },
      uGlow: { value: 0.36 },
      uFar: { value: [95, 135] },
    }]),
    fog: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
}
