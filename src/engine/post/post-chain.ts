import type { Camera } from 'three';
import {
  BlendFunction, BloomEffect, EdgeDetectionMode, type Effect, EffectPass, FXAAEffect, SMAAEffect, SMAAPreset,
} from 'postprocessing';
import type { QualitySettings } from '../quality';
import { GradeEffect } from './grade-effect';
import { MiniatureTiltShift } from './miniature-tilt-shift';
import type { ToneMap } from './post-params';
import { WetLensEffect } from './wet-lens-effect';

/** The effect passes for one quality preset (rebuilt when the preset changes). */
export interface PostChain {
  passes: EffectPass[];
  grade: GradeEffect;
  wet: WetLensEffect;
  tilt: MiniatureTiltShift | null;
  bloom: BloomEffect | null;
}

/**
 * Pass layout
 *  - medium/high: [wet(refract) → tilt-shift → bloom → grade(tone map)]  then  [SMAA] (+ dithering)
 *  - low:         [FXAA → wet(overlay) → tilt-shift → grade]  (single pass, no bloom)
 * Tilt-shift precedes bloom so blurred regions keep their glow; wet must lead because it samples the scene.
 */
export function buildPostChain(camera: Camera, q: QualitySettings, tone: ToneMap): PostChain {
  const grade = new GradeEffect(tone);
  const wet = new WetLensEffect(q.wetLensRefraction);
  const tilt = q.tiltShift ? new MiniatureTiltShift(q.tiltShiftKernel) : null;
  const bloom = q.bloom
    ? new BloomEffect({
      blendFunction: BlendFunction.ADD,
      mipmapBlur: true,
      luminanceThreshold: 1,
      luminanceSmoothing: 0.35,
      intensity: 1,
      radius: 0.6,
      levels: q.bloomLevels,
    })
    : null;

  const main: Effect[] = [];
  const passes: EffectPass[] = [];
  if (q.antialias === 'fxaa') main.push(new FXAAEffect());
  main.push(wet);
  if (tilt) main.push(tilt);
  if (bloom) main.push(bloom);
  main.push(grade);
  passes.push(new EffectPass(camera, ...main));

  if (q.antialias !== 'fxaa') {
    const smaa = new SMAAEffect({
      preset: q.antialias === 'smaa-high' ? SMAAPreset.HIGH : SMAAPreset.MEDIUM,
      edgeDetectionMode: EdgeDetectionMode.COLOR,
    });
    // input is display-linear (not gamma) → lower the threshold so dark edges are still found
    smaa.edgeDetectionMaterial.edgeDetectionThreshold = 0.05;
    passes.push(new EffectPass(camera, smaa));
  }
  passes[passes.length - 1].dithering = true;
  return { passes, grade, wet, tilt, bloom };
}
