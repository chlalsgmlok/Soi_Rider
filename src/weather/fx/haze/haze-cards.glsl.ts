/**
 * Smog banks: big soft camera-facing cards on a lattice around the rider that drifts with the wind and wraps
 * (GPU only). Each card is a churning fbm cloud, denser at its base, faded at the wrap edge and near the camera.
 */
export const HAZE_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform vec3 uCenter;
uniform float uSpan;
uniform vec2 uDrift;
uniform float uSize;
varying vec2 vUv;
varying float vFade;
varying float vSeed;
#include <fog_pars_vertex>
void main() {
  vec2 p = aSeed.xy * uSpan + uDrift;
  p = uCenter.xz + mod(p - uCenter.xz + 0.5 * uSpan, uSpan) - 0.5 * uSpan;
  float size = uSize * (0.6 + 0.8 * aSeed.w);
  vec2 rel = (p - uCenter.xz) / (0.5 * uSpan);
  float edge = 1.0 - smoothstep(0.65, 1.0, max(abs(rel.x), abs(rel.y)));
  vec3 world = vec3(p.x, uCenter.y + size * 0.28 + aSeed.z * 1.4, p.y);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  mvPosition.xy += position.xy * vec2(size * 1.5, size * 0.75);
  vFade = edge * smoothstep(4.0, 14.0, -mvPosition.z);
  vUv = position.xy * 2.0;
  vSeed = aSeed.w * 37.0 + aSeed.z * 11.0;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

export const HAZE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
varying float vFade;
varying float vSeed;
#include <fog_pars_fragment>
float hzHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hzNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hzHash(i), hzHash(i + vec2(1.0, 0.0)), u.x), mix(hzHash(i + vec2(0.0, 1.0)), hzHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec2 q = vUv * vec2(1.7, 0.85) + vec2(vSeed, vSeed * 0.37) + vec2(uTime * 0.035, uTime * 0.01);
  float n = 0.55 * hzNoise(q * 1.6) + 0.3 * hzNoise(q * 3.7 + 7.0) + 0.15 * hzNoise(q * 8.1 + 3.0);
  float a = smoothstep(1.0, 0.2, r) * smoothstep(0.16, 0.72, n) * vFade * uOpacity;
  a *= mix(1.0, 0.4, smoothstep(-0.5, 1.0, vUv.y));
  gl_FragColor = vec4(uColor, a);
  #include <fog_fragment>
}`;
