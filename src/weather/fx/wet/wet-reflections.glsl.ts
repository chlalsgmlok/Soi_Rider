/**
 * Light streaks on the wet road (mockup 02): for every light source the glossy reflection is a streak on the ground
 * starting where the mirror image of the light meets the road and running toward the viewer — long and bright at
 * grazing angles (POV), short and faint looking down (diorama). Computed per vertex from the source instance data
 * the traffic / city already upload (shared buffers, no CPU work):
 *  - FLARES: NPC lamp flares (instanceMatrix = lamp position, iGlow = rgb × intensity, size)
 *  - POOLS:  city light pools (instanceMatrix = ground spot × radius, instanceColor) — lamps, shop fronts, neon
 */
export const REFLECT_VERT = /* glsl */ `
#ifdef FLARES
attribute vec4 iGlow;
#endif
uniform float uStrength;
uniform float uStretch;
varying vec3 vColor;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vec4 src = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#ifdef FLARES
  float plane = 0.0;
  float h = max(src.y, 0.25);
  float size = iGlow.w;
  vec3 color = iGlow.rgb;
#else
  float radius = length(instanceMatrix[0].xyz);
  float plane = src.y - 0.02;
  float h = clamp(radius * 0.62, 1.5, 4.6);
  float size = clamp(radius * 0.15, 0.3, 0.9);
  vec3 color = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
  color = instanceColor;
  #endif
#endif
  vec3 cam = cameraPosition;
  float ch = max(cam.y - plane, 0.3);
  // ground point of the mirrored light seen from the camera
  vec2 q = mix(cam.xz, src.xz, ch / (ch + h));
  vec2 toCam = cam.xz - q;
  float d = length(toCam);
  vec2 ax = d > 1e-3 ? toCam / d : vec2(0.0, 1.0);
  vec2 sd = vec2(-ax.y, ax.x);
  float graze = 1.0 - ch / length(vec2(d, ch));
  // long grazing streaks spread the same light thinner (and never run past ~8 m)
  float len = min(uStretch * (0.5 + 0.9 * h) * (0.6 + 2.0 * graze * graze), 8.0);
  float spread = clamp(2.6 / len, 0.35, 1.0);
  float wid = size * (0.8 + 0.5 * graze);
  vec2 g = q + sd * position.x * wid + ax * position.y * len;
  vec4 mvPosition = viewMatrix * vec4(g.x, plane + 0.025, g.y, 1.0);
  // water reflects more at grazing angles (Fresnel-ish); nothing right under the camera
  float feet = smoothstep(1.0, 4.0, length(g - cam.xz));
  vColor = color * uStrength * (0.45 + 0.55 * graze * graze) * spread * feet;
  vUv = vec2(position.x * 2.0, position.y);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

export const REFLECT_FRAG = /* glsl */ `
varying vec3 vColor;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  float across = exp(-vUv.x * vUv.x * 4.0);
  float along = vUv.y < 0.0 ? exp(vUv.y * 9.0) : pow(1.0 - vUv.y, 1.6) * (0.55 + 0.45 * exp(-vUv.y * 5.0));
  // rippled water breaks the streak into flickering bands
  float bands = 0.75 + 0.25 * sin(vUv.y * 38.0 + vUv.x * 3.0);
  vec3 col = vColor * across * along * bands;
#ifdef USE_FOG
  #ifdef FOG_EXP2
  float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
  float fogF = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  col *= 1.0 - fogF;
#endif
  gl_FragColor = vec4(col, 1.0);
}`;
