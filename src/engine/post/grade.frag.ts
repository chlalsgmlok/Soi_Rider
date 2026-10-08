/**
 * Colour grade: exposure + white balance → saturation/contrast in scene-linear → tone map (define TONE_MAP)
 * → split toning (lavender shadows / peach highlights) → vignette. Output is display-linear 0..1.
 */
export const GRADE_FRAG = /* glsl */ `
#include <tonemapping_pars_fragment>

uniform float uExposure;
uniform vec3 uWhiteBalance;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform float uShadowTintAmount;
uniform vec3 uHighlightTint;
uniform float uVignette;

float gradeLuma(const in vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, vec3(0.0)) * uExposure * uWhiteBalance;

  float l = gradeLuma(c);
  c = max(mix(vec3(l), c, uSaturation), vec3(0.0));
  // contrast pivoting on scene mid-grey, applied per channel in log space
  c = 0.18 * pow(c / 0.18 + 1e-5, vec3(uContrast));

  c = TONE_MAP(c);

  float L = gradeLuma(c);
  c += uShadowTint * uShadowTintAmount * (1.0 - smoothstep(0.0, 0.45, L)) * 0.25;
  c *= mix(vec3(1.0), uHighlightTint, smoothstep(0.3, 0.95, L));

  vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(d) / length(vec2(aspect, 1.0) * 0.5);
  float vig = 1.0 - smoothstep(0.45, 1.05, r);
  c *= mix(1.0, vig, uVignette);

  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`;
