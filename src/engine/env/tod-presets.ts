import type { TimeOfDay } from '../../core/types';

/**
 * Authoring table for the four times of day (sRGB hex, degrees, light units = three.js physical intensities).
 * Sun azimuth: 0° = light coming FROM +Z, 90° = from +X. `night`/`lamps` feed gameplay + emissive lamps.
 * Grade values are what PostFx should receive for this light (Environment.grade).
 */
export interface TodPreset {
  sunElevation: number;
  sunAzimuth: number;
  sunColor: string;
  sunIntensity: number;
  /** 0..1 darkness of cast shadows */
  shadowIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  skyZenith: string;
  skyHorizon: string;
  /** colour of the glow around the sun on the horizon */
  skyGlow: string;
  glowStrength: number;
  /** HDR sun disc brightness in the sky (0 = hidden) */
  sunDisc: number;
  cloudCover: number;
  cloudLit: string;
  cloudShade: string;
  fogColor: string;
  fogDensity: number;
  envIntensity: number;
  stars: number;
  moon: number;
  night: number;
  lamps: number;
  exposure: number;
  warmth: number;
  saturation: number;
  contrast: number;
  bloom: number;
  bloomThreshold: number;
  vignette: number;
  shadowTint: string;
  shadowTintAmount: number;
  highlightTint: string;
}

export const TOD_PRESETS: Readonly<Record<TimeOfDay, TodPreset>> = {
  morning: {
    sunElevation: 26, sunAzimuth: 115, sunColor: '#ffd29a', sunIntensity: 3.2, shadowIntensity: 0.8,
    hemiSky: '#c6d1e2', hemiGround: '#b89878', hemiIntensity: 1.15,
    skyZenith: '#78a9e2', skyHorizon: '#f3e2cc', skyGlow: '#ffd2a0', glowStrength: 0.75, sunDisc: 6,
    cloudCover: 0.38, cloudLit: '#fff6ea', cloudShade: '#bcc4d8',
    fogColor: '#e8ddcc', fogDensity: 0.0045, envIntensity: 0.5,
    stars: 0, moon: 0, night: 0, lamps: 0,
    exposure: 0.98, warmth: 0.2, saturation: 1.12, contrast: 1.06, bloom: 0.55, bloomThreshold: 1.8,
    vignette: 0.28, shadowTint: '#34407a', shadowTintAmount: 0.24, highlightTint: '#fff2de',
  },
  noon: {
    sunElevation: 66, sunAzimuth: 160, sunColor: '#fff3df', sunIntensity: 3.5, shadowIntensity: 0.85,
    hemiSky: '#a6cdfa', hemiGround: '#b29b80', hemiIntensity: 1.3,
    skyZenith: '#3d8ce6', skyHorizon: '#bfe1f7', skyGlow: '#fff4d8', glowStrength: 0.35, sunDisc: 8,
    cloudCover: 0.42, cloudLit: '#ffffff', cloudShade: '#c4d0e4',
    fogColor: '#d3e4f0', fogDensity: 0.0026, envIntensity: 0.65,
    stars: 0, moon: 0, night: 0, lamps: 0,
    exposure: 0.95, warmth: 0.08, saturation: 1.14, contrast: 1.1, bloom: 0.45, bloomThreshold: 1.9,
    vignette: 0.22, shadowTint: '#25427e', shadowTintAmount: 0.25, highlightTint: '#fffaf0',
  },
  sunset: {
    sunElevation: 27, sunAzimuth: 70, sunColor: '#ffb46a', sunIntensity: 2.8, shadowIntensity: 0.74,
    hemiSky: '#d4b5bd', hemiGround: '#c98a5e', hemiIntensity: 1.35,
    skyZenith: '#7d86c9', skyHorizon: '#ffc994', skyGlow: '#ff9a5a', glowStrength: 1.25, sunDisc: 10,
    cloudCover: 0.46, cloudLit: '#ffd3a2', cloudShade: '#a98bb5',
    fogColor: '#f2c39c', fogDensity: 0.0058, envIntensity: 0.45,
    stars: 0, moon: 0, night: 0.25, lamps: 0.7,
    exposure: 0.92, warmth: 0.38, saturation: 1.2, contrast: 1.1, bloom: 0.7, bloomThreshold: 1.5,
    vignette: 0.32, shadowTint: '#5b3d6e', shadowTintAmount: 0.22, highlightTint: '#ffdcae',
  },
  night: {
    sunElevation: 42, sunAzimuth: 300, sunColor: '#9db2ff', sunIntensity: 0.6, shadowIntensity: 0.6,
    hemiSky: '#3c4c8e', hemiGround: '#2c2432', hemiIntensity: 0.95,
    skyZenith: '#0c1330', skyHorizon: '#2c2f5c', skyGlow: '#6c4c7e', glowStrength: 0.35, sunDisc: 0,
    cloudCover: 0.3, cloudLit: '#4c5476', cloudShade: '#1a1f36',
    fogColor: '#1e2242', fogDensity: 0.0055, envIntensity: 0.4,
    stars: 1, moon: 1, night: 1, lamps: 1,
    exposure: 1.35, warmth: -0.08, saturation: 1.16, contrast: 1.08, bloom: 1.25, bloomThreshold: 0.72,
    vignette: 0.42, shadowTint: '#1a2a6e', shadowTintAmount: 0.5, highlightTint: '#fff0dc',
  },
};
