/**
 * Rain on the lens/visor: two layers of beading drops that swell and evaporate, plus drops that slide down
 * leaving thin trails. With REFRACT each drop shows a flipped, slightly magnified view of the scene (needs the
 * input buffer → convolution attribute); without it the drops are a cheap shaded overlay.
 */
export const WET_LENS_FRAG = /* glsl */ `
uniform float uWet;
uniform float uWetTime;

// smoothstep that also works with e0 > e1 (GLSL leaves that undefined)
float wetStep(float e0, float e1, float x) {
  float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float wetHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 wetHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// xy = drop surface slope (refraction offset), z = coverage mask
vec3 beadLayer(vec2 uv, float cells, float seed, float density) {
  vec2 g = uv * vec2(aspect, 1.0) * cells;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 h = wetHash22(id + seed);
  float alive = step(1.0 - density, wetHash12(id * 1.37 + seed));
  float life = fract(uWetTime * (0.05 + 0.07 * h.x) + h.y);
  float grow = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.7, 1.0, life));
  float size = (0.13 + 0.2 * h.y) * grow;
  vec2 p = f - (h - 0.5) * 0.55;
  p.y *= 1.0 + 0.25 * h.x;
  float d = length(p);
  // drops that have not formed yet (size → 0) must not mask their whole cell
  float m = size > 0.004 ? wetStep(size, size * 0.78, d) * alive : 0.0;
  vec2 slope = clamp(p / max(size, 0.004), -1.5, 1.5);
  return vec3(slope * m, m);
}

// drops sliding down columns with a fading trail above them
vec3 slideLayer(vec2 uv, float density) {
  float cols = 18.0 * aspect;
  float cx = floor(uv.x * cols);
  float h = wetHash12(vec2(cx, 7.0));
  float alive = step(1.0 - density * 0.85, wetHash12(vec2(cx, 3.1)));
  float speed = 0.12 + 0.25 * h;
  float head = 1.15 - fract(uWetTime * speed + h * 9.0) * 1.4;
  float x = (fract(uv.x * cols) - 0.5 - (wetHash12(vec2(cx, 1.3)) - 0.5) * 0.5) / cols * aspect;
  float wobble = sin(uv.y * 40.0 + h * 20.0) * 0.0025;
  x += wobble;
  float dy = uv.y - head;
  float r = 0.012 + 0.008 * h;
  vec2 q = vec2(x, dy * 0.8);
  float headM = wetStep(r, r * 0.7, length(q));
  float trail = wetStep(r * 0.45, r * 0.15, abs(x)) * smoothstep(0.0, 0.02, dy) * (1.0 - smoothstep(0.02, 0.28, dy));
  float m = max(headM, trail * 0.6) * alive;
  vec2 slope = vec2(x / r, dy / r * 0.5) * headM;
  return vec3(slope * m, m);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uWet < 0.002) {
    outputColor = inputColor;
    return;
  }
  vec3 a = beadLayer(uv, 9.0, 1.0, uWet * 0.55);
  vec3 b = beadLayer(uv + 0.37, 17.0, 7.0, uWet * 0.75);
  vec3 s = slideLayer(uv, uWet);
  vec2 slope = a.xy + b.xy * 0.7 + s.xy;
  float mask = clamp(a.z + b.z + s.z, 0.0, 1.0);

  vec3 c = inputColor.rgb;
  // drops catch light from above: bright upper rim, darker lower edge
  float rim = clamp(-slope.y, 0.0, 1.0) * mask;
  float shade = clamp(slope.y, 0.0, 1.0) * mask;
#ifdef REFRACT
  vec2 ruv = clamp(uv - slope * 0.035 + vec2(0.0, 0.01) * mask, 0.001, 0.999);
  vec3 refr = texture2D(inputBuffer, ruv).rgb;
  c = mix(c, refr * 1.05, mask);
#else
  c *= 1.0 - 0.18 * mask;
#endif
  c *= 1.0 - 0.35 * shade;
  c += vec3(0.85, 0.9, 1.0) * pow(rim, 3.0) * 0.6 * (0.4 + 0.6 * uWet);
  // overall film of water: a touch of contrast loss
  c = mix(c, vec3(dot(c, vec3(0.333))), 0.08 * uWet);
  outputColor = vec4(c, inputColor.a);
}
`;
