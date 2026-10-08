/**
 * Stylised sky dome: zenith→horizon gradient, warm glow toward the sun, soft toon clouds (banded fbm with a
 * lit rim on the sun side), HDR sun disc (blooms), stars + moon at night, rain darkening. Rendered at the far
 * plane after opaque geometry so hidden sky pixels are never shaded.
 */
export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

export const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uGlowStrength;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunDisc;
uniform vec3 uMoonDir;
uniform float uMoon;
uniform float uStars;
uniform float uCloudCover;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform float uTime;
uniform vec3 uGround;
varying vec3 vDir;

float skyHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float skyNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
             mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float skyFbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * skyNoise(p);
    p = p * 2.07 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  float up = clamp(y, 0.0, 1.0);

  // gradient: horizon band hugs the ground, zenith above
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.62, up), 0.75));

  // sun glow (wide) + halo (tight)
  float sd = max(dot(d, uSunDir), 0.0);
  float horizonBand = 1.0 - smoothstep(0.0, 0.45, up);
  col += uGlow * uGlowStrength * (pow(sd, 6.0) * (0.35 + 0.65 * horizonBand) + 0.6 * pow(sd, 48.0));

  // clouds on a virtual plane
  if (uCloudCover > 0.01 && y > 0.0) {
    vec2 cuv = d.xz / (y + 0.12) * 0.55 + vec2(uTime * 0.004, uTime * 0.0015);
    float n = skyFbm(cuv * 1.6);
    float edge = 1.0 - uCloudCover;
    float shape = smoothstep(edge - 0.02, edge + 0.16, n);
    vec2 toSun = normalize(uSunDir.xz + 1e-4) * 0.06;
    float lit = smoothstep(edge, edge + 0.3, skyFbm((cuv - toSun) * 1.6));
    float rim = clamp((shape - lit) * 1.6, 0.0, 1.0);
    vec3 cloud = mix(uCloudShade, uCloudLit, 0.35 + 0.65 * (1.0 - lit) + rim * 0.5);
    cloud += uGlow * uGlowStrength * pow(sd, 4.0) * 0.6 * rim;
    float fade = smoothstep(0.0, 0.18, y);
    col = mix(col, cloud, shape * fade);
  }

  // sun disc (HDR → bloom) and moon
  float disc = smoothstep(0.99955, 0.99975, sd);
  col += uSunColor * uSunDisc * disc;
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.85, 0.9, 1.0) * uMoon * (smoothstep(0.99935, 0.9996, md) * 2.4 + pow(md, 220.0) * 0.18);

  // stars: hashed cells on a sphere-ish projection, twinkling
  if (uStars > 0.01 && y > 0.05) {
    vec2 sp = d.xz / (1.0 + y) * 180.0;
    vec2 cell = floor(sp);
    float h = skyHash(cell);
    vec2 pos = fract(sp) - 0.5 - (vec2(skyHash(cell + 3.1), skyHash(cell + 7.7)) - 0.5) * 0.7;
    float star = step(0.985, h) * (1.0 - smoothstep(0.0, 0.09, length(pos)));
    float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 40.0);
    col += vec3(0.9, 0.93, 1.0) * star * tw * uStars * smoothstep(0.05, 0.3, y) * 1.6;
  }

  // at and below the horizon: melt into the fog colour so distant geometry meets the sky seamlessly
  col = mix(col, uGround, 1.0 - smoothstep(-0.04, 0.07, y));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
