import { Color, Uniform, Vector3 } from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { GRADE_FRAG } from './grade.frag';
import type { ToneMap } from './post-params';

const TONE_FN: Record<ToneMap, string> = {
  neutral: 'NeutralToneMapping(c)',
  aces: 'ACESFilmicToneMapping(c)',
  agx: 'AgXToneMapping(c)',
};

export interface GradeValues {
  exposure: number;
  warmth: number;
  saturation: number;
  contrast: number;
  vignette: number;
  shadowTintAmount: number;
}

function gradeUniforms() {
  return {
    uExposure: new Uniform(1),
    uWhiteBalance: new Uniform(new Vector3(1, 1, 1)),
    uSaturation: new Uniform(1),
    uContrast: new Uniform(1),
    uShadowTint: new Uniform(new Color(0, 0, 0)),
    uShadowTintAmount: new Uniform(0),
    uHighlightTint: new Uniform(new Color(1, 1, 1)),
    uVignette: new Uniform(0),
  };
}

/** Single merged colour-grade effect (cheap: one shader stage inside the main EffectPass). */
export class GradeEffect extends Effect {
  private tone: ToneMap;
  private readonly u: ReturnType<typeof gradeUniforms>;

  constructor(tone: ToneMap = 'neutral') {
    const u = gradeUniforms();
    super('GradeEffect', GRADE_FRAG, {
      blendFunction: BlendFunction.SRC,
      defines: new Map([['TONE_MAP(c)', TONE_FN[tone]]]),
      uniforms: new Map<string, Uniform>(Object.entries(u)),
    });
    this.u = u;
    this.tone = tone;
  }

  get toneMap(): ToneMap {
    return this.tone;
  }

  set toneMap(t: ToneMap) {
    if (t === this.tone) return;
    this.tone = t;
    this.defines.set('TONE_MAP(c)', TONE_FN[t]);
    this.setChanged();
  }

  apply(v: GradeValues, shadowTint: Color, highlightTint: Color): void {
    const u = this.u;
    u.uExposure.value = v.exposure;
    u.uSaturation.value = v.saturation;
    u.uContrast.value = v.contrast;
    u.uVignette.value = v.vignette;
    u.uShadowTintAmount.value = v.shadowTintAmount;
    u.uShadowTint.value.copy(shadowTint);
    u.uHighlightTint.value.copy(highlightTint);
    whiteBalance(v.warmth, u.uWhiteBalance.value);
  }
}

/** warm/cool white-balance gains with roughly constant luminance */
export function whiteBalance(warmth: number, out: Vector3): Vector3 {
  const w = Math.max(-1, Math.min(1, warmth));
  out.set(1 + 0.16 * w, 1 + 0.03 * w, 1 - 0.2 * w);
  const l = 0.2126 * out.x + 0.7152 * out.y + 0.0722 * out.z;
  return out.multiplyScalar(1 / l);
}
