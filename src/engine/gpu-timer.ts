import type { WebGLRenderer } from 'three';

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

/**
 * GPU frame time via EXT_disjoint_timer_query_webgl2 (async: results arrive 1–3 frames later).
 * Independent of CPU load, so it measures what the frame really costs the GPU. `ms` stays −1 when the
 * extension is unavailable (Safari, some mobile GPUs).
 */
export class GpuTimer {
  /** smoothed GPU milliseconds per measured frame (−1 = unsupported / no sample yet) */
  ms = -1;
  /** latest raw sample (ms) and the number of samples received so far (for benchmarks) */
  lastMs = -1;
  samples = 0;
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExt | null;
  private readonly pending: WebGLQuery[] = [];
  private readonly pool: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(renderer: WebGLRenderer) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
  }

  get supported(): boolean {
    return this.ext !== null;
  }

  begin(): void {
    if (!this.ext || this.active || this.pending.length > 4) return;
    const q = this.pool.pop() ?? this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** collect finished queries (call once per frame, after end) */
  poll(): void {
    if (!this.ext) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      this.pool.push(q);
      if (disjoint) continue;
      const ms = ns / 1e6;
      this.lastMs = ms;
      this.samples++;
      this.ms = this.ms < 0 ? ms : this.ms + (ms - this.ms) * 0.1;
    }
  }

  dispose(): void {
    if (this.active && this.ext) this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    for (const q of [...this.pending, ...this.pool]) this.gl.deleteQuery(q);
    this.pending.length = 0;
    this.pool.length = 0;
    this.active = null;
  }
}
