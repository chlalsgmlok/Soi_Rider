/**
 * GLSL for the ground material: world-space surface patterns per aGround id (asphalt grain + patches, gutter seams,
 * sidewalk tiles, curb wear, apron pavers, court slabs, weedy back lots, lawns, planted medians, concrete) and the
 * wet look (darkening of porous surfaces, glossy film, puddles in the asphalt's low spots).
 */
export const GROUND_VERT_PARS = /* glsl */ `
attribute float aGround;
varying float vGKind;
varying vec3 vGWorld;
varying float vGUp;
`;

export const GROUND_BEGIN_VERTEX = /* glsl */ `
#include <begin_vertex>
vGKind = aGround;
vGUp = normal.y;
vec4 gWorld = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  gWorld = batchingMatrix * gWorld;
#endif
vGWorld = ( modelMatrix * gWorld ).xyz;
`;

export const GROUND_FRAG_PARS = /* glsl */ `
uniform float uGWet;
varying float vGKind;
varying vec3 vGWorld;
varying float vGUp;
float gHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float gNoise( vec2 p ) {
  vec2 i = floor( p ); vec2 f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  float a = gHash( i ); float b = gHash( i + vec2( 1.0, 0.0 ) );
  float c = gHash( i + vec2( 0.0, 1.0 ) ); float d = gHash( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}
float gFbm( vec2 p ) { return gNoise( p ) * 0.55 + gNoise( p * 2.03 + 7.1 ) * 0.3 + gNoise( p * 4.1 + 3.7 ) * 0.15; }
float gGrout( vec2 f, float w ) { return smoothstep( 0.0, w, min( min( f.x, 1.0 - f.x ), min( f.y, 1.0 - f.y ) ) ); }
`;

/** appended after <color_fragment>: pattern + wetness; defines gRoughOut for the roughness chunk */
export const GROUND_PATTERN = /* glsl */ `
int gk = int( vGKind + 0.5 );
vec2 gp = vGWorld.xz;
float gRough = 0.85;
float gPorous = 0.6;
float gPuddle = 0.0;
if ( gk == 0 ) {
  float n1 = gFbm( gp * 0.06 );
  diffuseColor.rgb *= 0.88 + 0.17 * n1 + 0.06 * gNoise( gp * 1.9 ) + 0.04 * gNoise( gp * 7.0 );
  gRough = 0.9; gPorous = 0.5;
  gPuddle = smoothstep( 0.62, 0.7, gFbm( gp * 0.085 + 13.0 ) );
} else if ( gk == 1 ) {
  diffuseColor.rgb *= ( 0.9 + 0.12 * gNoise( gp * 3.0 ) ) * mix( 0.72, 1.0, gGrout( fract( gp ), 0.03 ) );
  gRough = 0.8; gPorous = 0.5;
  gPuddle = 0.7 * smoothstep( 0.45, 0.65, gNoise( gp * 0.45 ) );
} else if ( gk == 2 ) {
  vec2 t = gp / 0.4;
  vec2 id = floor( t );
  diffuseColor.rgb *= ( 0.93 + 0.1 * gHash( id ) ) * mix( 0.74, 1.0, gGrout( fract( t ), 0.06 ) );
  if ( mod( id.x + id.y, 2.0 ) < 0.5 ) diffuseColor.rgb *= 0.965;
  diffuseColor.rgb *= 0.9 + 0.14 * gFbm( gp * 0.22 );
  gRough = 0.8; gPorous = 0.7;
} else if ( gk == 3 ) {
  diffuseColor.rgb *= 0.88 + 0.14 * gNoise( gp * 2.6 );
  gRough = 0.55; gPorous = 0.35;
} else if ( gk == 4 ) {
  vec2 t = gp / vec2( 0.24, 0.12 );
  t.x += step( 1.0, mod( floor( t.y ), 2.0 ) ) * 0.5;
  diffuseColor.rgb *= ( 0.92 + 0.12 * gHash( floor( t ) ) ) * mix( 0.7, 1.0, gGrout( fract( t ), 0.08 ) );
  diffuseColor.rgb *= 0.9 + 0.14 * gFbm( gp * 0.3 );
  gRough = 0.85; gPorous = 0.7;
} else if ( gk == 5 ) {
  vec2 t = gp / 0.9;
  diffuseColor.rgb *= ( 0.94 + 0.08 * gHash( floor( t ) ) ) * mix( 0.8, 1.0, gGrout( fract( t ), 0.025 ) );
  gRough = 0.75; gPorous = 0.55;
} else if ( gk == 6 ) {
  float m = gFbm( gp * 0.045 );
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.12, 0.22, 0.045 ), smoothstep( 0.42, 0.62, m ) );
  diffuseColor.rgb *= 0.86 + 0.2 * gNoise( gp * 0.9 );
  gRough = 0.95; gPorous = 0.75;
  gPuddle = 0.6 * smoothstep( 0.7, 0.78, gFbm( gp * 0.07 + 5.0 ) );
} else if ( gk == 7 ) {
  diffuseColor.rgb *= ( 0.88 + 0.16 * gFbm( gp * 0.35 ) ) * ( 0.97 + 0.03 * sign( sin( gp.x * 1.4 ) ) );
  gRough = 0.95; gPorous = 0.3;
} else if ( gk == 8 ) {
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.16, 0.1, 0.05 ), smoothstep( 0.55, 0.75, gFbm( gp * 0.4 ) ) * 0.6 );
  diffuseColor.rgb *= 0.88 + 0.18 * gNoise( gp * 2.2 );
  gRough = 0.95; gPorous = 0.4;
} else {
  diffuseColor.rgb *= 0.88 + 0.14 * gFbm( gp * 0.7 );
}
float gWet = uGWet * smoothstep( 0.3, 0.8, vGUp );
diffuseColor.rgb *= mix( 1.0, 1.0 - 0.5 * gPorous, gWet );
float gPud = gPuddle * smoothstep( 0.2, 0.7, uGWet ) * step( 0.5, vGUp );
diffuseColor.rgb *= mix( 1.0, 0.5, gPud );
float gRoughOut = mix( gRough, gRough * 0.5, gWet );
gRoughOut = mix( gRoughOut, 0.035, gPud );
`;

export const GROUND_ROUGHNESS = /* glsl */ `float roughnessFactor = gRoughOut;`;
