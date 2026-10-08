import { FpsMeter } from './fps-meter';

export interface LoopCallbacks {
  /**
   * Fixed simulation step. Called at 60 Hz of REAL time; `dt` is 1/60 × timeScale, so slow-motion stays smooth
   * (more, smaller game-time steps) instead of stuttering.
   */
  step(dt: number): void;
  /**
   * Once per animation frame (also while paused). `alpha` = leftover fraction of a step (0..1) for optional
   * interpolation; `frameDt` = real seconds since the last frame (clamped).
   */
  render(alpha: number, frameDt: number): void;
}

/** rAF game loop with a fixed 60 Hz step, accumulator, frame clamp, pause and time scale. */
export class GameLoop {
  static readonly STEP = 1 / 60;
  /** clamp for one frame's real dt (tab switches, breakpoints) */
  static readonly MAX_FRAME = 0.25;

  /** game-time multiplier (slow-mo < 1). 0 freezes the simulation but keeps rendering. */
  timeScale = 1;
  /** most fixed steps run in a single frame before the backlog is dropped */
  maxSteps = 5;
  readonly fps = new FpsMeter();
  /** steps executed during the last frame (diagnostics) */
  stepsLastFrame = 0;
  /** total fixed steps since start */
  stepCount = 0;

  private acc = 0;
  private last = -1;
  private raf = 0;
  private isRunning = false;
  private isPaused = false;

  constructor(private readonly cb: LoopCallbacks) {}

  get running(): boolean {
    return this.isRunning;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.last = -1;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.raf);
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.acc = 0;
  }

  /**
   * Advance by one frame at timestamp `nowMs` (performance.now() domain). Public so tests and offline
   * captures can drive the loop without rAF.
   */
  tick(nowMs: number): void {
    const raw = this.last < 0 ? GameLoop.STEP : (nowMs - this.last) / 1000;
    this.last = nowMs;
    this.fps.push(raw);
    const frameDt = Math.min(Math.max(raw, 0), GameLoop.MAX_FRAME);
    let steps = 0;
    if (!this.isPaused) {
      this.acc += frameDt;
      const dt = GameLoop.STEP * this.timeScale;
      while (this.acc >= GameLoop.STEP && steps < this.maxSteps) {
        if (dt > 0) this.cb.step(dt);
        this.acc -= GameLoop.STEP;
        steps++;
      }
      // drop the backlog we could not afford, keep only the fractional remainder
      if (steps >= this.maxSteps && this.acc >= GameLoop.STEP) this.acc %= GameLoop.STEP;
    }
    this.stepsLastFrame = steps;
    this.stepCount += steps;
    this.cb.render(this.isPaused ? 0 : this.acc / GameLoop.STEP, frameDt);
  }

  private readonly frame = (now: number): void => {
    if (!this.isRunning) return;
    this.raf = requestAnimationFrame(this.frame);
    this.tick(now);
  };
}
