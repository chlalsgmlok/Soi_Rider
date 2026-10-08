import { Color, type PerspectiveCamera, Vector3 } from 'three';
import type { Environment } from '../../engine/env/environment';
import type { WeatherState } from '../types';

/**
 * How a white, unlit FX surface (a raindrop, a puff of spray) would be lit right now, read from the Environment
 * lights so particles sit in the same light as the toon-shaded scene (linear, pre-exposure, like scene radiance).
 */
export interface FxLight {
  /** sky fill (hemisphere, sky side) reflected by a white diffuse particle */
  readonly ambient: Color;
  /** sun/moon light reflected by a white diffuse particle facing it */
  readonly sun: Color;
  readonly fog: Color;
  /** unit vector toward the sun */
  readonly sunDir: Vector3;
  /** warm street-lamp / neon spill on airborne water at night */
  readonly lampGlow: Color;
  night: number;
  lamps: number;
}

/** Everything the weather FX read in one frame (filled once by WeatherSystem, read-only for the FX). */
export interface FxFrame {
  dt: number;
  /** FX clock (seconds) */
  time: number;
  readonly camera: PerspectiveCamera;
  readonly camPos: Vector3;
  /** unit view direction */
  readonly camDir: Vector3;
  /** smoothed camera velocity (m/s) — rain streaks stretch with the relative motion */
  readonly camVel: Vector3;
  /** ground point the FX gather around: the rider, else what the camera looks at */
  readonly focus: Vector3;
  /** unit XZ direction the rider/camera faces (spawning is biased ahead) */
  readonly ahead: Vector3;
  /** wind velocity (m/s, XZ) */
  readonly wind: Vector3;
  /** device pixels per unit view-space size at depth 1 (min line widths) */
  pxPerUnit: number;
  readonly state: Readonly<WeatherState>;
  readonly light: FxLight;
  groundHeight(x: number, z: number): number;
}

export function createFxLight(): FxLight {
  return {
    ambient: new Color(), sun: new Color(), fog: new Color(), sunDir: new Vector3(0, 1, 0), lampGlow: new Color(),
    night: 0, lamps: 0,
  };
}

const LAMP = new Color('#ffb070');

/** out += c × k (three's Color has no addScaled) */
export function addScaled(out: Color, c: Color, k: number): Color {
  out.r += c.r * k;
  out.g += c.g * k;
  out.b += c.b * k;
  return out;
}
const INV_PI = 1 / Math.PI;

/** sample the Environment's current lights into `out` */
export function readFxLight(env: Environment, out: FxLight): FxLight {
  const h = env.hemi;
  addScaled(out.ambient.copy(h.color).multiplyScalar(h.intensity * INV_PI * 1.15), h.groundColor, h.intensity * INV_PI * 0.25);
  out.sun.copy(env.sun.color).multiplyScalar(env.sun.intensity * INV_PI);
  out.fog.copy(env.fog.color);
  out.sunDir.copy(env.sunDirection);
  out.night = env.night;
  out.lamps = env.lampsOn;
  out.lampGlow.copy(LAMP).multiplyScalar(0.16 * env.lampsOn * Math.min(1, env.night * 1.3));
  return out;
}
