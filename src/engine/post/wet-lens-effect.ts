import { Uniform } from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { WET_LENS_FRAG } from './wet-lens.frag';

/** Screen-space raindrops on the lens (POV rain). `refract` samples the scene → must be the first effect of its pass. */
export class WetLensEffect extends Effect {
  private readonly uWet: Uniform<number>;
  private readonly uTime: Uniform<number>;

  constructor(refract: boolean) {
    const uWet = new Uniform(0);
    const uTime = new Uniform(0);
    super('WetLensEffect', WET_LENS_FRAG, {
      blendFunction: BlendFunction.SRC,
      attributes: refract ? EffectAttribute.CONVOLUTION : EffectAttribute.NONE,
      defines: refract ? new Map([['REFRACT', '1']]) : new Map<string, string>(),
      uniforms: new Map<string, Uniform>([
        ['uWet', uWet],
        ['uWetTime', uTime],
      ]),
    });
    this.uWet = uWet;
    this.uTime = uTime;
  }

  set wet(v: number) {
    this.uWet.value = v;
  }

  advance(dt: number): void {
    this.uTime.value = (this.uTime.value + dt) % 1000;
  }
}
