import type { QualityPreset } from '../core/types';

/** Anti-aliasing strategy applied as the last post pass. */
export type AntiAlias = 'smaa-high' | 'smaa-medium' | 'fxaa';
export type BlurKernel = 'small' | 'medium' | 'large';

/**
 * Everything that scales with the quality preset. The engine applies the rendering fields itself;
 * the *hint* fields are read by other modules (traffic, world, weather) when they build/update.
 */
export interface QualitySettings {
  readonly preset: QualityPreset;
  /** upper bound for devicePixelRatio */
  readonly pixelRatio: number;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  /** half-extent (m) of the sun shadow frustum around the focus point (coverage = 2×) */
  readonly shadowExtent: number;
  /** PCF filter radius in texels (soft edge) */
  readonly shadowRadius: number;
  readonly tiltShift: boolean;
  readonly tiltShiftKernel: BlurKernel;
  readonly bloom: boolean;
  /** mip levels of the mipmap bloom (more = wider glow) */
  readonly bloomLevels: number;
  readonly antialias: AntiAlias;
  /** lens raindrops refract the scene (else a cheaper overlay) */
  readonly wetLensRefraction: boolean;
  /** image-based lighting from the sky (PMREM); 0 disables */
  readonly envMapSize: number;
  /** HINT — max simultaneously simulated+drawn NPC vehicles */
  readonly maxNpcVehicles: number;
  /** HINT — max pedestrians */
  readonly maxPedestrians: number;
  /** HINT — metres beyond which city chunks/props are culled; also the camera far plane */
  readonly drawDistance: number;
  /** distance (m) at which fog is ~fully opaque, so culled geometry never pops */
  readonly fogFar: number;
  /** HINT — 0..1 multiplier on decorative street props (pots, stools, crates) */
  readonly propDensity: number;
  /** HINT — 0..1 multiplier on overhead cable bundles */
  readonly wireDensity: number;
  /** HINT — rain streak particle budget */
  readonly rainDrops: number;
}

export const QUALITY_PRESETS: Readonly<Record<QualityPreset, QualitySettings>> = {
  low: {
    preset: 'low',
    pixelRatio: 0.85,
    shadows: true,
    shadowMapSize: 1024,
    shadowExtent: 26,
    shadowRadius: 2,
    tiltShift: true,
    tiltShiftKernel: 'small',
    bloom: false,
    bloomLevels: 0,
    antialias: 'fxaa',
    wetLensRefraction: false,
    envMapSize: 0,
    maxNpcVehicles: 26,
    maxPedestrians: 16,
    drawDistance: 240,
    fogFar: 220,
    propDensity: 0.55,
    wireDensity: 0.4,
    rainDrops: 2500,
  },
  medium: {
    preset: 'medium',
    pixelRatio: 1,
    shadows: true,
    shadowMapSize: 2048,
    shadowExtent: 36,
    shadowRadius: 3,
    tiltShift: true,
    tiltShiftKernel: 'medium',
    bloom: true,
    bloomLevels: 6,
    antialias: 'smaa-medium',
    wetLensRefraction: true,
    envMapSize: 128,
    maxNpcVehicles: 48,
    maxPedestrians: 34,
    drawDistance: 340,
    fogFar: 320,
    propDensity: 0.8,
    wireDensity: 0.75,
    rainDrops: 6000,
  },
  high: {
    preset: 'high',
    pixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 4096,
    shadowExtent: 46,
    shadowRadius: 3,
    tiltShift: true,
    tiltShiftKernel: 'large',
    bloom: true,
    bloomLevels: 8,
    antialias: 'smaa-high',
    wetLensRefraction: true,
    envMapSize: 256,
    maxNpcVehicles: 72,
    maxPedestrians: 60,
    drawDistance: 460,
    fogFar: 440,
    propDensity: 1,
    wireDensity: 1,
    rainDrops: 12000,
  },
};

export const QUALITY_ORDER: readonly QualityPreset[] = ['low', 'medium', 'high'];

export const qualitySettings = (preset: QualityPreset): QualitySettings => QUALITY_PRESETS[preset];

/** one step cheaper, or null when already the lowest */
export function lowerPreset(preset: QualityPreset): QualityPreset | null {
  const i = QUALITY_ORDER.indexOf(preset);
  return i > 0 ? QUALITY_ORDER[i - 1] : null;
}

export function isQualityPreset(v: string | null | undefined): v is QualityPreset {
  return v === 'low' || v === 'medium' || v === 'high';
}
