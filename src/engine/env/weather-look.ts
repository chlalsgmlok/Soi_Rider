import { Color } from 'three';
import { copyLook, type LookState, type WeatherInput } from './env-look';

const c01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const luma = (c: Color): number => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

/** hue references (sRGB hex → linear on construction) */
const OVERCAST_FILL = new Color('#c9cfd9');
const RAIN_FILL = new Color('#8f9db4');
const RAIN_SKY = new Color('#5d6a80');
const RAIN_SHADOW = new Color('#24365f');
const SMOG = new Color('#c9b78a');
const SMOG_SUN = new Color('#ff9a5c');
const WHITE = new Color(1, 1, 1);
const tmp = new Color();

/**
 * Move `c` toward the hue of `ref` by `amount`, at `lumScale` × the ORIGINAL luminance — weather recolours
 * the light without making night brighter or noon darker by accident.
 */
function retint(c: Color, ref: Color, amount: number, lumScale = 1): void {
  if (amount <= 0 && lumScale === 1) return;
  const l = luma(c);
  tmp.copy(ref).multiplyScalar((l / Math.max(1e-5, luma(ref))) * lumScale);
  c.lerp(tmp, c01(amount));
}

/**
 * Overcast / rain / haze on top of a time-of-day look (pure: reads `base`, writes `out`).
 *  - overcast: the sun is swallowed by a bright grey softbox → soft light, faint shadows, flatter grade
 *  - rain: darker slate sky, almost no sun or shadow, cool blue fill, lamps on, stronger bloom (mockup 02)
 *  - haze: yellow-grey PM2.5 smog → dense warm fog, orange sun, washed-out low-contrast grade
 */
export function applyWeather(base: LookState, w: WeatherInput, out: LookState): LookState {
  copyLook(base, out);
  const o = c01(w.overcast);
  const r = c01(w.rain);
  const h = c01(w.haze);
  const cloudy = Math.max(o, r);
  const day = 1 - base.night;

  // key light
  out.sunIntensity *= (1 - 0.8 * o) * (1 - 0.9 * r) * (1 - 0.35 * h);
  out.shadowIntensity *= (1 - 0.65 * o) * (1 - 0.8 * r) * (1 - 0.3 * h);
  retint(out.sunColor, SMOG_SUN, 0.35 * h);

  // fill light: the cloud deck becomes the light source
  retint(out.hemiSky, OVERCAST_FILL, 0.75 * o, 1 + 0.15 * o * day);
  retint(out.hemiSky, RAIN_FILL, 0.8 * r, 1 - 0.4 * r);
  retint(out.hemiSky, SMOG, 0.4 * h);
  retint(out.hemiGround, RAIN_FILL, 0.45 * r, 1 - 0.35 * r);
  out.hemiIntensity *= (1 + 0.35 * o * day) * (1 + 0.15 * r * day * day);

  // sky dome
  retint(out.skyZenith, RAIN_SKY, 0.6 * o + 0.4 * r, 1 - 0.1 * o - 0.5 * r);
  retint(out.skyHorizon, RAIN_SKY, 0.5 * o + 0.35 * r, 1 - 0.4 * r);
  retint(out.skyGlow, OVERCAST_FILL, 0.6 * cloudy, 1 - 0.5 * cloudy);
  out.cloudCover += (1 - out.cloudCover) * Math.max(0.9 * o, r);
  retint(out.cloudLit, OVERCAST_FILL, 0.65 * cloudy, 1 - 0.45 * r);
  retint(out.cloudShade, RAIN_SKY, 0.6 * cloudy, 1 - 0.55 * r);
  out.glowStrength *= (1 - 0.75 * cloudy) * (1 + 0.5 * h);
  out.sunDisc *= (1 - cloudy) * (1 - 0.65 * h);
  out.stars *= 1 - cloudy;
  out.moon *= 1 - 0.9 * cloudy;

  // fog: rain mist takes the sky colour; smog is yellow-grey and dims at night
  out.fogColor.lerp(out.skyHorizon, 0.6 * cloudy);
  tmp.copy(SMOG).multiplyScalar(0.22 + 0.78 * day);
  out.fogColor.lerp(tmp, 0.85 * h);
  out.skyHorizon.lerp(tmp, 0.7 * h);
  out.skyZenith.lerp(out.skyHorizon, 0.45 * h);
  out.fogDensity += 0.0022 * o + 0.009 * r + 0.016 * h;

  // grade
  out.saturation *= (1 - 0.18 * o) * (1 - 0.05 * r) * (1 - 0.3 * h);
  out.contrast *= (1 - 0.08 * o) * (1 + 0.08 * r) * (1 - 0.18 * h);
  out.warmth += -0.3 * o * day - 0.42 * r + 0.16 * h;
  // rain at dusk is the moodiest light (mockup 02): lit surfaces drop ~⅓ stop more, emissives keep their punch
  const dusk = 4 * day * (1 - day);
  out.exposure *= (1 + 0.18 * o * day) * (1 + 0.1 * r * day * day) * (1 - 0.3 * r * dusk);
  // rain clouds bring dusk early: everything that keys off darkness (lamps, headlights, windows) follows
  out.night = c01(out.night + 0.3 * r * day + 0.08 * o * day);
  out.envIntensity *= 1 - 0.1 * cloudy;
  out.lamps = c01(out.lamps + 0.65 * r + 0.25 * o + 0.15 * h);
  out.bloom *= 1 + 0.55 * r;
  out.bloomThreshold *= 1 - 0.3 * r;
  out.vignette += 0.08 * r;
  retint(out.shadowTint, RAIN_SHADOW, 0.7 * r);
  out.shadowTintAmount *= 1 - 0.45 * o;
  out.highlightTint.lerp(WHITE, 0.7 * cloudy);
  return out;
}
