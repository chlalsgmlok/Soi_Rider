import type { WebGLRenderer } from 'three';
import type { QualityPreset } from '../core/types';
import type { FpsMeter } from './fps-meter';
import type { GpuTimer } from './gpu-timer';
import type { SceneRenderStats } from './post/scene-pass';

/** Per-frame performance snapshot (perf HUD, sandboxes, auto-quality diagnostics). */
export interface EngineStats {
  fps: number;
  frameMs: number;
  /** GPU time of the last frames (scene + shadows + post), −1 when the timer extension is unavailable */
  gpuMs: number;
  /** CPU time spent inside render() (scene traversal, draw submission, post) */
  cpuMs: number;
  /** scene draw calls incl. shadow maps (post passes excluded) */
  drawCalls: number;
  triangles: number;
  programs: number;
  geometries: number;
  textures: number;
  preset: QualityPreset;
  pixelRatio: number;
  width: number;
  height: number;
}

export interface StatsSources {
  renderer: WebGLRenderer;
  fps: FpsMeter;
  gpu: GpuTimer;
  cpuMs: number;
  scene: Readonly<SceneRenderStats>;
  preset: QualityPreset;
  width: number;
  height: number;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

export function collectStats(src: StatsSources): EngineStats {
  const info = src.renderer.info;
  return {
    fps: Math.round(src.fps.fps * 10) / 10,
    frameMs: r2(src.fps.frameMs),
    gpuMs: r2(src.gpu.ms),
    cpuMs: r2(src.cpuMs),
    drawCalls: src.scene.drawCalls,
    triangles: src.scene.triangles,
    programs: info.programs?.length ?? 0,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    preset: src.preset,
    pixelRatio: src.renderer.getPixelRatio(),
    width: src.width,
    height: src.height,
  };
}
