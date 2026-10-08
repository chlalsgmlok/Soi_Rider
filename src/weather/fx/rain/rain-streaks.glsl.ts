/**
 * Rain streaks: every drop lives on a world-anchored lattice that falls with the wind-slanted velocity and wraps
 * inside a box around the camera — drops never swim when the camera moves and the CPU never touches them.
 * Each quad spans head → tail of the drop's motion RELATIVE to the camera (riding forward pulls the rain toward
 * the lens), with a minimum on-screen width so far drops fade out instead of shimmering.
 */
export const RAIN_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform vec3 uVel;
uniform vec3 uCamVel;
uniform float uStreak;
uniform float uWidth;
uniform float uPx;
uniform float uRain;
varying float vAlpha;
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  if (aSeed.w > uRain) {
    gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    return;
  }
  vec3 vel = uVel * (0.82 + 0.36 * fract(aSeed.w * 7.13 + aSeed.x));
  vec3 p = aSeed.xyz * uBox + vel * uTime;
  p = uCenter + mod(p - uCenter + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec3 tail = p - (vel - uCamVel) * uStreak;
  vec4 a = viewMatrix * vec4(p, 1.0);
  vec4 b = viewMatrix * vec4(tail, 1.0);
  vec4 mvPosition = mix(a, b, position.y);
  vec2 d = b.xy / max(-b.z, 0.05) - a.xy / max(-a.z, 0.05);
  vec2 side = normalize(vec2(-d.y, d.x) + vec2(1e-5, 0.0));
  float depth = max(-mvPosition.z, 0.05);
  float w = max(uWidth, uPx * depth);
  mvPosition.xy += side * position.x * w;
  // keep the energy of sub-pixel drops (fade instead of fattening), no streaks smeared over the lens
  vAlpha = (uWidth / w) * smoothstep(1.0, 4.5, depth);
  vUv = vec2(position.x * 2.0, position.y);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

export const RAIN_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  float across = 1.0 - vUv.x * vUv.x;
  float along = smoothstep(0.0, 0.12, vUv.y) * (1.0 - 0.75 * smoothstep(0.45, 1.0, vUv.y));
  gl_FragColor = vec4(uColor, across * along * vAlpha * uOpacity);
  #include <fog_fragment>
}`;
