import { Color } from 'three';
import type { TodPreset } from './tod-presets';

/** Weather inputs (0..1 each), usually driven by src/weather. */
export interface WeatherInput {
  overcast: number;
  rain: number;
  /** smog / PM2.5 */
  haze: number;
}
export const COLOR_FIELDS = [
  'sunColor', 'hemiSky', 'hemiGround', 'skyZenith', 'skyHorizon', 'skyGlow', 'cloudLit', 'cloudShade',
  'fogColor', 'shadowTint', 'highlightTint',
] as const;
export const NUM_FIELDS = [
  'sunElevation', 'sunAzimuth', 'sunIntensity', 'shadowIntensity', 'hemiIntensity', 'glowStrength', 'sunDisc',
  'cloudCover', 'fogDensity', 'envIntensity', 'stars', 'moon', 'night', 'lamps', 'exposure', 'warmth',
  'saturation', 'contrast', 'bloom', 'bloomThreshold', 'vignette', 'shadowTintAmount',
] as const;

type ColorField = (typeof COLOR_FIELDS)[number];
type NumField = (typeof NUM_FIELDS)[number];

/** Runtime look: colours in linear working space, numbers as in TodPreset. */
export type LookState = { [K in ColorField]: Color } & { [K in NumField]: number };

export function createLook(): LookState {
  const look = {} as LookState;
  for (const k of COLOR_FIELDS) look[k] = new Color();
  for (const k of NUM_FIELDS) look[k] = 0;
  return look;
}

export function lookFromPreset(p: TodPreset, out: LookState = createLook()): LookState {
  for (const k of COLOR_FIELDS) out[k].set(p[k]);
  for (const k of NUM_FIELDS) out[k] = p[k];
  return out;
}

export function copyLook(src: LookState, out: LookState): LookState {
  for (const k of COLOR_FIELDS) out[k].copy(src[k]);
  for (const k of NUM_FIELDS) out[k] = src[k];
  return out;
}

/** blend two looks; azimuth takes the shortest way round */
export function lerpLook(a: LookState, b: LookState, t: number, out: LookState): LookState {
  for (const k of COLOR_FIELDS) out[k].lerpColors(a[k], b[k], t);
  for (const k of NUM_FIELDS) out[k] = a[k] + (b[k] - a[k]) * t;
  let dAz = ((b.sunAzimuth - a.sunAzimuth + 540) % 360) - 180;
  if (dAz === -180) dAz = 180;
  out.sunAzimuth = a.sunAzimuth + dAz * t;
  return out;
}
