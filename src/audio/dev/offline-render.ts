import { AudioGraph } from '../audio-graph';
import type { SelfTestCase } from './self-test-cases';

/** control-rate step for driven cases (engine throttle profiles, sequencer ticks) */
const STEP = 0.025;
const SEED = 0x7e57;

/**
 * Render one case through a fresh offline sound graph. Driven cases pause the offline render every 25 ms
 * (`suspend`) so the same housekeeping / control code as the realtime game runs on the offline clock.
 * `limiter: false` renders the raw mix (no glue compressor / limiter / safety clip) to check headroom.
 */
export async function renderCase(c: SelfTestCase, sampleRate: number, limiter: boolean): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(c.seconds * sampleRate), sampleRate);
  const g = new AudioGraph(ctx, SEED, { limiter });
  const drive = (t: number): void => {
    if (c.tick) g.tick(t);
    c.step?.(g, t);
  };
  if (c.tick || c.step) {
    for (let t = STEP; t < c.seconds - STEP; t += STEP) {
      ctx
        .suspend(t)
        .then(() => {
          drive(ctx.currentTime);
          return ctx.resume();
        })
        .catch((err: unknown) => console.error(`[audio self-test] ${c.name} step failed`, err));
    }
  }
  c.start(g);
  drive(0);
  return ctx.startRendering();
}

/** wall-clock render time ÷ audio time of one case (mastered) — 0.05 ≈ 5 % of one core in realtime */
export async function renderCost(c: SelfTestCase, sampleRate = 48000): Promise<number> {
  const t0 = performance.now();
  await renderCase(c, sampleRate, true);
  return (performance.now() - t0) / 1000 / c.seconds;
}
