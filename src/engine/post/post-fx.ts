import { HalfFloatType, type PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'postprocessing';
import type { QualitySettings } from '../quality';
import { buildPostChain, type PostChain } from './post-chain';
import { type PostFxParams, SmoothedPostParams, type ToneMap } from './post-params';
import { SceneRenderPass, type SceneRenderStats } from './scene-pass';

/**
 * pmndrs postprocessing stack: scene → [wet lens, tilt-shift, bloom, colour grade + tone map] → SMAA/FXAA.
 * `set()` takes targets; values are smoothed every `render(dt)`.
 */
export class PostFx {
  readonly composer: EffectComposer;
  private readonly params = new SmoothedPostParams();
  private readonly scenePass: SceneRenderPass;
  private chain: PostChain;
  /** ACES won the look-dev comparison: richest saturation for mockup 03's golden hour (AgX read too pastel) */
  private tone: ToneMap = 'aces';
  private quality: QualitySettings;

  constructor(
    renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    quality: QualitySettings,
  ) {
    this.quality = quality;
    this.composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, stencilBuffer: false });
    this.scenePass = new SceneRenderPass(new Scene(), camera);
    this.composer.addPass(this.scenePass);
    this.chain = buildPostChain(camera, quality, this.tone);
    for (const p of this.chain.passes) this.composer.addPass(p);
    this.params.snap();
  }

  /** smoothed values currently applied */
  get current(): Readonly<PostFxParams> {
    return this.params.current;
  }

  /** draw calls / triangles of the last scene render (incl. shadow maps, excl. post) */
  get sceneStats(): Readonly<SceneRenderStats> {
    return this.scenePass.stats;
  }

  get toneMap(): ToneMap {
    return this.tone;
  }

  set toneMap(t: ToneMap) {
    this.tone = t;
    this.chain.grade.toneMap = t;
  }

  setScene(scene: Scene): void {
    this.scenePass.mainScene = scene;
  }

  /** set targets (smoothed). Unknown keys are ignored. */
  set(p: Partial<PostFxParams>): void {
    this.params.set(p);
  }

  /** jump straight to the targets (scene cuts) */
  snap(): void {
    this.params.snap();
  }

  setQuality(q: QualitySettings): void {
    if (q === this.quality) return;
    this.quality = q;
    for (const p of this.chain.passes) {
      this.composer.removePass(p);
      p.dispose();
    }
    this.chain = buildPostChain(this.camera, q, this.tone);
    for (const p of this.chain.passes) this.composer.addPass(p);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height, false);
  }

  render(dt: number): void {
    this.params.update(dt);
    this.apply(dt);
    this.composer.render(dt);
  }

  dispose(): void {
    this.composer.dispose();
  }

  private apply(dt: number): void {
    const c = this.params.current;
    const { grade, wet, tilt, bloom } = this.chain;
    grade.apply(c, this.params.colors.shadowTint, this.params.colors.highlightTint);
    wet.wet = c.wet;
    wet.advance(dt);
    tilt?.configure(c.tiltShift, c.focusY, c.focusBand, c.focusFeather);
    if (bloom) {
      bloom.intensity = c.bloom;
      // threshold is display-referred: undo the exposure applied later in the grade
      bloom.luminanceMaterial.threshold = c.bloomThreshold / Math.max(0.05, c.exposure);
    }
  }
}
