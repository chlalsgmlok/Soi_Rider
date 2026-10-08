import type { Camera, Scene, WebGLRenderer, WebGLRenderTarget } from 'three';
import { RenderPass } from 'postprocessing';

export interface SceneRenderStats {
  /** draw calls of the scene render incl. shadow maps (post passes excluded) */
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
}

/** RenderPass that records renderer.info right after the scene (+ shadow) render. */
export class SceneRenderPass extends RenderPass {
  readonly stats: SceneRenderStats = { drawCalls: 0, triangles: 0, points: 0, lines: 0 };

  constructor(scene: Scene, camera: Camera) {
    super(scene, camera);
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget | null,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
    stencilTest?: boolean,
  ): void {
    super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
    const r = renderer.info.render;
    this.stats.drawCalls = r.calls;
    this.stats.triangles = r.triangles;
    this.stats.points = r.points;
    this.stats.lines = r.lines;
  }
}
