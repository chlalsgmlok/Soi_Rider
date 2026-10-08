import type { AudioGraph } from './audio-graph';

/** housekeeping period; the music scheduler looks 200 ms ahead, so a few late ticks never starve it */
const TICK_MS = 25;

/**
 * Keeps a realtime AudioGraph alive: the 25 ms housekeeping tick on the audio clock (music look-ahead, city
 * life, engine auto-restart, traffic swells) and, optionally, suspending the context while the tab is hidden
 * so nothing keeps playing in a background tab. Resumes by itself when the tab comes back.
 */
export class RealtimeDriver {
  private timer: number | null = null;
  private suspendedByUs = false;
  private readonly onVisibility = (): void => {
    if (document.hidden) {
      if (this.ctx.state !== 'running') return;
      this.suspendedByUs = true;
      this.ctx.suspend().catch((err: unknown) => console.warn('[audio] suspend failed', err));
    } else if (this.suspendedByUs) {
      this.suspendedByUs = false;
      this.ctx.resume().catch((err: unknown) => console.warn('[audio] resume failed', err));
    }
  };

  constructor(
    private readonly ctx: AudioContext,
    private readonly graph: AudioGraph,
    private readonly pauseWhenHidden: boolean,
  ) {}

  start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    if (this.pauseWhenHidden) document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** run one housekeeping pass now (also called by the interval) */
  tick(): void {
    if (this.ctx.state !== 'running') return;
    try {
      this.graph.tick(this.ctx.currentTime);
    } catch (err) {
      console.error('[audio] tick failed', err);
    }
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
