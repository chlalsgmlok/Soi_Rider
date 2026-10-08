/**
 * GLSL for the city uber material (MeshStandardMaterial patch). Per vertex: colour, roughness / metalness (aSurf) and
 * aKind = tint + 8 · emissive class. Per instance (BatchedMesh colour texture, vec4): x/y/z = palette indices of the
 * three tint channels (x ≥ 100 on untinted instances = cut-away fade 0..1 as 100 + 100·fade), w = shutter state
 * (integer part) + random seed (fraction).
 */
export const CITY_VERT_PARS = /* glsl */ `
attribute float aKind;
attribute vec2 aSurf;
uniform vec3 uCityPalette[64];
uniform vec3 uCityEmis[8];
uniform float uCityTime;
uniform vec2 uCityShutter;
uniform vec4 uCityFocus;
varying vec2 vCitySurf;
varying vec4 vCityClip;
varying vec4 vCityFocusClip;
varying float vCityCable;
varying vec3 vCityEmissive;
varying float vCityFade;
float cityHash( vec3 p ) {
  return fract( sin( dot( p, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
}
`;

/** replaces <color_vertex>: tinted base colour, surface response and emissive per vertex */
export const CITY_COLOR_VERTEX = /* glsl */ `
vec4 cityInst = vec4( 0.0 );
#ifdef USE_BATCHING_COLOR
  cityInst = getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif
float cityTint = mod( aKind + 0.5, 8.0 ) - 0.5;
int cityCls = int( floor( ( aKind + 0.5 ) / 8.0 ) );
vec3 cityBase = color.rgb;
if ( cityTint > 0.5 && cityTint < 3.5 ) {
  float ci = cityTint < 1.5 ? cityInst.x : ( cityTint < 2.5 ? cityInst.y : cityInst.z );
  if ( ci > 0.5 ) cityBase = uCityPalette[ int( ci + 0.5 ) ];
}
vColor = vec4( cityBase, 1.0 );
vCitySurf = aSurf;
vCityFade = cityInst.x > 99.5 ? clamp( ( cityInst.x - 100.0 ) / 100.0, 0.0, 1.0 ) : 0.0;
float citySeed = fract( cityInst.w );
vec3 cityEmis = uCityEmis[ cityCls ];
if ( cityCls == 1 ) {
  float lit = step( 0.45, cityHash( vec3( floor( position.y / 2.9 ), floor( position.x / 6.0 ), citySeed * 97.0 + 3.1 ) ) );
  vCityEmissive = cityEmis * lit;
} else {
  vCityEmissive = cityBase * cityEmis;
}
`;

/** replaces <begin_vertex>: roller shutters per instance state, gentle foliage sway */
export const CITY_BEGIN_VERTEX = /* glsl */ `
vec3 transformed = vec3( position );
if ( abs( cityTint - 4.0 ) < 0.5 ) {
  float st = floor( cityInst.w + 0.001 );
  float span = max( 0.05, uCityShutter.x - uCityShutter.y );
  float k = st > 2.5 ? 0.14 : ( st > 1.5 ? ( uCityShutter.x - 0.12 ) / span : 1.0 );
  transformed.y = uCityShutter.x - ( uCityShutter.x - transformed.y ) * k;
}
if ( abs( cityTint - 5.0 ) < 0.5 ) {
  float h = max( 0.0, transformed.y - 1.0 );
  float ph = uCityTime * 1.15 + citySeed * 6.2831;
  transformed.x += sin( ph + transformed.z * 0.35 ) * 0.011 * h;
  transformed.z += cos( ph * 0.83 + transformed.x * 0.3 ) * 0.008 * h;
}
`;

/**
 * after <project_vertex>: hands the fragment stage aspect-corrected clip positions of the vertex and of the rider
 * (uCityFocus.xyz) plus an "overhead" flag, so cables (tint 6), swaying foliage (tint 5) and anything above head
 * height (lamp heads, awnings, signs, balconies) in front of the rider and near them on screen dissolve per fragment
 * (cable segments are metres long — a per-vertex test misses them).
 */
export const CITY_PROJECT_VERTEX = /* glsl */ `
#include <project_vertex>
float cityAsp = projectionMatrix[ 1 ][ 1 ] / projectionMatrix[ 0 ][ 0 ];
vCityClip = vec4( gl_Position.x * cityAsp, gl_Position.yzw );
vec4 cityFc = projectionMatrix * viewMatrix * vec4( uCityFocus.xyz, 1.0 );
vCityFocusClip = vec4( cityFc.x * cityAsp, cityFc.yzw );
vec4 cityW = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  cityW = batchingMatrix * cityW;
#endif
#ifdef USE_INSTANCING
  cityW = instanceMatrix * cityW;
#endif
cityW = modelMatrix * cityW;
vCityCable = ( abs( cityTint - 6.0 ) < 0.5 || abs( cityTint - 5.0 ) < 0.5 || cityW.y > 2.6 ) ? 1.0 : 0.0;
`;

export const CITY_FRAG_PARS = /* glsl */ `
uniform vec4 uCityFocus;
varying vec2 vCitySurf;
varying vec4 vCityClip;
varying vec4 vCityFocusClip;
varying float vCityCable;
varying vec3 vCityEmissive;
varying float vCityFade;
const float CITY_BAYER[16] = float[16]( 0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0 );
`;

/** screen-door cut-away (viaduct between the diorama camera and the road, cables/foliage over the rider): ordered dither */
export const CITY_FADE = /* glsl */ `
#include <clipping_planes_fragment>
float cityCut = vCityFade;
// an elevated chase camera whose boom passes through a tree canopy / under an awning: overhead geometry closer than
// ~6 m to the lens melts away instead of filling the screen (not in POV, where the camera sits at eye height)
if ( vCityCable > 0.5 && cameraPosition.y > 3.5 ) cityCut = max( cityCut, 1.0 - smoothstep( 2.5, 6.0, vCityClip.w ) );
if ( vCityCable > 0.5 && uCityFocus.w > 0.0 && vCityFocusClip.w > 0.0 && vCityClip.w < vCityFocusClip.w - 1.0 ) {
  vec2 cityD = vCityClip.xy / vCityClip.w - vCityFocusClip.xy / vCityFocusClip.w;
  cityCut = max( cityCut, 0.9 * ( 1.0 - smoothstep( uCityFocus.w * 0.55, uCityFocus.w, length( cityD ) ) ) );
}
if ( cityCut > 0.001 ) {
  ivec2 q = ivec2( mod( gl_FragCoord.xy, 4.0 ) );
  if ( ( CITY_BAYER[ q.x + q.y * 4 ] + 0.5 ) / 16.0 < cityCut ) discard;
}
`;

export const CITY_ROUGHNESS = /* glsl */ `float roughnessFactor = vCitySurf.x;`;
/** metalness < 0 marks matte vertices (wires, foliage, hedges): no specular, so sub-pixel edges never sparkle */
export const CITY_METALNESS = /* glsl */ `
float metalnessFactor = max( vCitySurf.y, 0.0 );
float citySpec = vCitySurf.y < -0.5 ? 0.0 : 1.0;
`;
export const CITY_LIGHTS_END = /* glsl */ `
#include <lights_fragment_end>
reflectedLight.directSpecular *= citySpec;
reflectedLight.indirectSpecular *= citySpec;
`;
export const CITY_EMISSIVE = /* glsl */ `totalEmissiveRadiance = vCityEmissive;`;
