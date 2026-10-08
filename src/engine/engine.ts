import { NoToneMapping, PCFShadowMap, PerspectiveCamera, type Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { CAMERA } from '../core/config/camera';
import type { QualityPreset } from '../core/types';
import { collectStats, type EngineStats } from './engine-stats';
import { FpsMeter } from './fps-meter';
import { GpuTimer } from './gpu-timer';
import { PostFx } from './post/post-fx';
import { type QualitySettings, qualitySettings } from './quality';
import { AutoQuality } from './quality-auto';

export interface EngineOptions {
  /** fixed preset or 'auto' (starts at `autoStart`, steps down while riding if fps < 50) */
  quality?: QualityPreset | 'auto';
  autoStart?: QualityPreset;
}

type QualityListener = (q: QualitySettings) => void;

/**
 * Owns the WebGLRenderer, the ONE PerspectiveCamera (other modules move it), the post stack and the quality preset.
 * `render()` renders the current scene through PostFx and measures the frame.
 */
export class Engine {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  readonly post: PostFx;
  readonly fps = new FpsMeter();
  scene: Scene | null = null;

  /** GPU frame timer (perf HUD, benchmarks) */
  readonly gpu: GpuTimer;
  private cpuMs = 0;
  private q: QualitySettings;
  private mode: QualityPreset | 'auto';
  private auto: AutoQuality | null = null;
  private readonly listeners = new Set<QualityListener>();
  private last = -1;
  private width = 1;
  private height = 1;

  constructor(readonly canvas: HTMLCanvasElement, opts: EngineOptions = {}) {
    this.mode = opts.quality ?? 'medium';
    const start = this.mode === 'auto' ? opts.autoStart ?? 'medium' : this.mode;
    if (this.mode === 'auto') this.auto = new AutoQuality(start);
    this.q = qualitySettings(start);

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = this.q.shadows;
    // r186 removed PCFSoftShadowMap: PCF + light.shadow.radius gives the soft edge (see SunRig)
    this.renderer.shadowMap.type = PCFShadowMap;

    this.camera = new PerspectiveCamera(CAMERA.diorama.fov, 16 / 9, CAMERA.near, CAMERA.far);
    this.post = new PostFx(this.renderer, this.camera, this.q);
    this.gpu = new GpuTimer(this.renderer);

    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    this.resize();
    addEventListener('resize', this.resize);
  }

  get quality(): QualitySettings {
    return this.q;
  }

  get qualityMode(): QualityPreset | 'auto' {
    return this.mode;
  }

  /** notified after every preset change (including auto step-downs); returns an unsubscribe */
  onQualityChange(fn: QualityListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setQuality(mode: QualityPreset | 'auto'): void {
    this.mode = mode;
    if (mode === 'auto') {
      this.auto = new AutoQuality(this.q.preset === 'low' ? 'medium' : this.q.preset);
      this.applyPreset(this.auto.preset);
    } else {
      this.auto = null;
      this.applyPreset(mode);
    }
  }

  /** 'auto' mode: start sampling fps (call when riding starts); no-op for fixed presets */
  beginAutoQuality(): void {
    this.auto?.begin();
  }

  /** 'auto' mode: stop sampling (menus, pause) */
  endAutoQuality(): void {
    this.auto?.end();
  }

  setScene(scene: Scene): void {
    this.scene = scene;
    this.post.setScene(scene);
  }

  /** the game is full-window: the canvas always matches the viewport */
  readonly resize = (): void => {
    const w = Math.max(1, Math.floor(innerWidth));
    const h = Math.max(1, Math.floor(innerHeight));
    const pr = Math.min(devicePixelRatio || 1, this.q.pixelRatio);
    const prChanged = Math.abs(this.renderer.getPixelRatio() - pr) > 1e-3;
    if (w === this.width && h === this.height && !prChanged) return;
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(pr);
    this.post.setSize(w, h);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  /** render the current scene through the post stack; measures frame time and feeds 'auto' quality */
  render(): void {
    const now = performance.now();
    const raw = this.last < 0 ? 1 / 60 : (now - this.last) / 1000;
    this.last = now;
    this.fps.push(raw);
    if (this.auto) {
      const next = this.auto.sample(raw);
      if (next) this.applyPreset(next);
    }
    if (!this.scene) return;
    this.gpu.begin();
    this.post.render(Math.min(raw, 0.1));
    this.gpu.end();
    this.gpu.poll();
    const cpu = performance.now() - now;
    this.cpuMs += (cpu - this.cpuMs) * 0.1;
  }

  stats(): EngineStats {
    return collectStats({
      renderer: this.renderer, fps: this.fps, gpu: this.gpu, cpuMs: this.cpuMs, scene: this.post.sceneStats,
      preset: this.q.preset, width: this.width, height: this.height,
    });
  }

  dispose(): void {
    removeEventListener('resize', this.resize);
    this.gpu.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.listeners.clear();
  }

  private applyPreset(preset: QualityPreset): void {
    const q = qualitySettings(preset);
    if (q === this.q) return;
    this.q = q;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.post.setQuality(q);
    this.width = 0; // force a resize (pixel ratio may differ)
    this.resize();
    for (const fn of this.listeners) fn(q);
  }
}
