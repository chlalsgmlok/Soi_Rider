import { Color, type ColorRepresentation, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

export interface RingStyle {
  color: ColorRepresentation;
  /** main ring radius / half line width (m) */
  radius: number;
  width: number;
  /** optional dashed outer ring (radius 0 = none) and its dash count */
  outer?: number;
  dashes?: number;
  /** expanding pulse rings: period (s, 0 = none) and max radius (m) */
  pulse?: number;
  pulseTo?: number;
  /** faint disc fill inside the main ring (alpha) */
  fill?: number;
  /** glow halo strength */
  glow?: number;
}

const VERT = /* glsl */ `
varying vec2 vP;
uniform float uSize;
void main() {
  vP = (uv - 0.5) * uSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uR, uW, uOuter, uDashes, uPulse, uPulseTo, uFill, uGlow, uTime, uOpacity;
varying vec2 vP;
float line(float r, float R, float w, float aa) { return 1.0 - smoothstep(w - aa, w + aa, abs(r - R)); }
void main() {
  float r = length(vP);
  float aa = fwidth(r) * 1.2 + 0.004;
  float a = line(r, uR, uW, aa);
  float halo = exp(-pow((r - uR) / (uW * 3.0 + 0.05), 2.0)) * uGlow;
  if (uOuter > 0.0) {
    float ang = atan(vP.y, vP.x) / 6.2831853 + 0.5;
    float dash = step(0.42, fract(ang * uDashes + uTime * 0.05));
    a = max(a, line(r, uOuter, uW * 0.8, aa) * dash * 0.85);
  }
  if (uPulse > 0.0) {
    for (int k = 0; k < 2; k++) {
      float t = fract(uTime / uPulse + float(k) * 0.5);
      float R = mix(uR * 0.3, uPulseTo, t);
      a = max(a, line(r, R, uW * 1.3, aa) * (1.0 - t) * (1.0 - t) * 0.9);
    }
  }
  float fill = uFill * (1.0 - smoothstep(uR - aa, uR + aa, r));
  float alpha = max(max(a, halo), fill) * uOpacity;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}`;

/**
 * Flat glowing rings painted on the ground (shader on one quad): the cyan ring under the rider (mockup 03) and the
 * coral stop zone under the target pin (solid inner ring, dashed 4 m stop radius, expanding pulses).
 */
export function createGroundRing(style: RingStyle): Mesh<PlaneGeometry, ShaderMaterial> {
  const reach = Math.max(style.radius, style.outer ?? 0, style.pulseTo ?? 0) + 0.7;
  const size = reach * 2;
  const geo = new PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new ShaderMaterial({
    name: 'gram_ring',
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new Color(style.color) },
      uSize: { value: size },
      uR: { value: style.radius },
      uW: { value: style.width },
      uOuter: { value: style.outer ?? 0 },
      uDashes: { value: style.dashes ?? 24 },
      uPulse: { value: style.pulse ?? 0 },
      uPulseTo: { value: style.pulseTo ?? style.radius },
      uFill: { value: style.fill ?? 0 },
      uGlow: { value: style.glow ?? 0.35 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });
  const mesh = new Mesh(geo, mat);
  mesh.renderOrder = 4;
  return mesh;
}

/** advance the ring's clock and opacity */
export function tickRing(ring: Mesh<PlaneGeometry, ShaderMaterial>, time: number, opacity: number): void {
  ring.material.uniforms.uTime.value = time;
  ring.material.uniforms.uOpacity.value = opacity;
  ring.visible = opacity > 0.003;
}
