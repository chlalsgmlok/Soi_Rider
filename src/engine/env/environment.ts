import { type DirectionalLight, FogExp2, Group, HemisphereLight, type Scene, Vector3, type WebGLRenderer } from 'three';
import { damp, smoothstep } from '../../core/math2d';
import type { TimeOfDay } from '../../core/types';
import type { PostFxParams } from '../post/post-params';
import type { QualitySettings } from '../quality';
import { copyLook, createLook, lerpLook, lookFromPreset, type LookState, type WeatherInput } from './env-look';
import { SkyDome } from './sky-dome';
import { SkyEnvMap } from './sky-envmap';
import { SunRig } from './sun-rig';
import { TOD_PRESETS } from './tod-presets';
import { applyWeather } from './weather-look';

/** grade fields the Environment recommends to PostFx for the current light */
export type EnvGrade = Pick<PostFxParams, 'exposure' | 'warmth' | 'saturation' | 'contrast' | 'bloom' | 'bloomThreshold'
  | 'vignette' | 'shadowTint' | 'highlightTint' | 'shadowTintAmount'>;

/**
 * Time of day × weather → sky dome, sun (with focus-following shadows), hemisphere fill, fog, sky IBL and a
 * matching colour grade. Blends smoothly: `setTimeOfDay(tod, sec)`, `setWeather(w, sec)`. Call `update` every frame.
 */
export class Environment {
  readonly root = new Group();
  readonly sky = new SkyDome();
  readonly fog = new FogExp2(0xffffff, 0.004);
  readonly hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  /** final look after weather (read-only for other modules) */
  readonly look: LookState = createLook();
  /** 0 day … 1 full night */
  night = 0;
  /** 0..1 street lamps / neon / windows (rises at dusk, in rain, at night) */
  lampsOn = 0;
  private readonly sunRig: SunRig;
  private readonly envMap: SkyEnvMap;
  private readonly base = createLook();
  private readonly from = createLook();
  private readonly to = createLook();
  private blend = 1;
  private blendSec = 0;
  private tod: TimeOfDay;
  private readonly weatherNow: WeatherInput = { overcast: 0, rain: 0, haze: 0 };
  private readonly weatherTarget: WeatherInput = { overcast: 0, rain: 0, haze: 0 };
  private weatherRate = 2;
  private quality: QualitySettings;
  private scene: Scene | null = null;
  private time = 0;
  private envDirty = true;

  constructor(renderer: WebGLRenderer, quality: QualitySettings, tod: TimeOfDay = 'sunset') {
    this.quality = quality;
    this.tod = tod;
    this.sunRig = new SunRig(quality);
    this.envMap = new SkyEnvMap(renderer, this.sky, quality.envMapSize);
    this.hemi.name = 'sky_fill';
    this.root.name = 'environment';
    this.root.add(this.sky.mesh, this.sunRig.light, this.sunRig.light.target, this.hemi);
    lookFromPreset(TOD_PRESETS[tod], this.base);
    copyLook(this.base, this.to);
    this.compose();
  }

  get sun(): DirectionalLight {
    return this.sunRig.light;
  }

  /** unit vector toward the sun/moon */
  get sunDirection(): Vector3 {
    return this.sunRig.direction;
  }

  get timeOfDay(): TimeOfDay {
    return this.tod;
  }

  /** current (smoothed) weather inputs */
  get weather(): Readonly<WeatherInput> {
    return this.weatherNow;
  }

  /** add sky + lights to the scene and take over its fog/environment */
  attach(scene: Scene): void {
    this.scene = scene;
    scene.add(this.root);
    scene.fog = this.fog;
    scene.background = null;
    this.envDirty = true;
  }

  setTimeOfDay(tod: TimeOfDay, blendSec = 0): void {
    this.tod = tod;
    copyLook(this.base, this.from);
    lookFromPreset(TOD_PRESETS[tod], this.to);
    this.blendSec = Math.max(0, blendSec);
    this.blend = this.blendSec > 0 ? 0 : 1;
    if (this.blend >= 1) copyLook(this.to, this.base);
    this.envDirty = true;
  }

  /** weather targets 0..1; reached with a ~blendSec ease (0 = instant) */
  setWeather(w: Partial<WeatherInput>, blendSec = 1.5): void {
    Object.assign(this.weatherTarget, w);
    this.weatherRate = blendSec > 0 ? 3 / blendSec : Infinity;
    if (blendSec <= 0) Object.assign(this.weatherNow, this.weatherTarget);
  }

  setQuality(q: QualitySettings): void {
    this.quality = q;
    this.sunRig.applyQuality(q);
    this.envMap.setSize(q.envMapSize);
    this.envDirty = true;
  }

  /** recommended grade for PostFx (merge with the camera's tilt-shift values) */
  grade(): EnvGrade {
    const l = this.look;
    return {
      exposure: l.exposure, warmth: l.warmth, saturation: l.saturation, contrast: l.contrast, bloom: l.bloom,
      bloomThreshold: l.bloomThreshold, vignette: l.vignette, shadowTintAmount: l.shadowTintAmount,
      shadowTint: `#${l.shadowTint.getHexString()}`, highlightTint: `#${l.highlightTint.getHexString()}`,
    };
  }

  /** advance blends, aim shadows at `focus` (player / camera target), refresh IBL when needed */
  update(dt: number, focus: Vector3): void {
    this.time += dt;
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.blendSec);
      lerpLook(this.from, this.to, smoothstep(0, 1, this.blend), this.base);
    }
    const k = Number.isFinite(this.weatherRate) ? damp(this.weatherRate, dt) : 1;
    for (const key of ['overcast', 'rain', 'haze'] as const) {
      this.weatherNow[key] += (this.weatherTarget[key] - this.weatherNow[key]) * k;
    }
    this.compose();
    this.sunRig.follow(focus);
    this.refreshEnvMap(dt);
  }

  dispose(): void {
    this.root.removeFromParent();
    if (this.scene?.fog === this.fog) this.scene.fog = null;
    if (this.scene && this.scene.environment === this.envMap.texture) this.scene.environment = null;
    this.sky.dispose();
    this.envMap.dispose();
    this.sunRig.light.shadow.map?.dispose();
    this.sunRig.light.dispose();
  }

  private compose(): void {
    const l = applyWeather(this.base, this.weatherNow, this.look);
    this.sunRig.setAngles(l.sunElevation, l.sunAzimuth);
    const sun = this.sunRig.light;
    sun.color.copy(l.sunColor);
    sun.intensity = l.sunIntensity * smoothstep(-2, 6, l.sunElevation);
    sun.shadow.intensity = l.shadowIntensity;
    this.hemi.color.copy(l.hemiSky);
    this.hemi.groundColor.copy(l.hemiGround);
    this.hemi.intensity = l.hemiIntensity;
    this.fog.color.copy(l.fogColor);
    this.fog.density = Math.max(l.fogDensity, 1.6 / this.quality.fogFar);
    this.sky.apply(l, this.sunRig.direction, this.sunRig.direction, this.time);
    this.night = l.night;
    this.lampsOn = l.lamps;
  }

  private refreshEnvMap(dt: number): void {
    const l = this.look;
    const d = this.sunRig.direction;
    const sig = l.skyZenith.r + l.skyZenith.g * 1.3 + l.skyHorizon.b * 1.7 + l.skyHorizon.r * 0.9 + l.cloudCover * 0.6 +
      l.glowStrength * 0.3 + l.fogColor.g * 0.8 + d.x * 0.5 + d.y * 0.7 + d.z * 0.4;
    const baked = this.envMap.update(dt, sig, this.envDirty);
    this.envDirty = false;
    if (!this.scene) return;
    if (baked || this.scene.environment !== this.envMap.texture) this.scene.environment = this.envMap.texture;
    this.scene.environmentIntensity = l.envIntensity;
  }
}
