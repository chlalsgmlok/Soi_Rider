/**
 * Frame-rate meter: windowed average fps (stable for display) plus an exponential moving average of the
 * frame time and the worst frame in the last window (spikes / hitches).
 */
export class FpsMeter {
  /** frames per second over the last completed window */
  fps = 60;
  /** smoothed frame time (ms) */
  frameMs = 16.7;
  /** slowest frame (ms) in the last completed window */
  worstMs = 16.7;

  private frames = 0;
  private elapsed = 0;
  private worst = 0;

  constructor(private readonly windowSec = 0.5) {}

  /** feed one frame's real duration (seconds, unclamped) */
  push(dt: number): void {
    if (!(dt > 0)) return;
    this.frames++;
    this.elapsed += dt;
    this.worst = Math.max(this.worst, dt);
    this.frameMs += (dt * 1000 - this.frameMs) * 0.1;
    if (this.elapsed >= this.windowSec) {
      this.fps = this.frames / this.elapsed;
      this.worstMs = this.worst * 1000;
      this.frames = 0;
      this.elapsed = 0;
      this.worst = 0;
    }
  }

  reset(): void {
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
    this.fps = 60;
    this.frameMs = 16.7;
    this.worstMs = 16.7;
  }
}
