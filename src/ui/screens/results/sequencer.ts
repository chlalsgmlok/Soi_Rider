/**
 * Skippable choreography timeline for reward screens (Results, Intro).
 *   await seq.wait(300); await seq.play(stamp(el)); await seq.count(countUp(el, 0, 900));
 * skip() fast-forwards: pending waits resolve now, tracked animations finish, count-ups jump to their final value,
 * and everything started afterwards completes instantly. dispose() (screen destroyed) abandons the chain: pending
 * promises never resolve, so the async sequence simply stops without touching a dead DOM.
 */
import type { CountUp } from '../../core/count-up';
import { settled } from '../../core/animate';

const never = (): Promise<void> => new Promise<void>(() => undefined);

export class Sequencer {
  private skipped = false;
  private dead = false;
  private timers = new Map<ReturnType<typeof setTimeout>, () => void>();
  private anims = new Set<Animation>();
  private counts = new Set<CountUp>();

  /** true once skip() was called: start new effects in their final state */
  get fast(): boolean {
    return this.skipped;
  }

  get disposed(): boolean {
    return this.dead;
  }

  wait(ms: number): Promise<void> {
    if (this.dead) return never();
    if (this.skipped || ms <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const id = setTimeout(() => {
        this.timers.delete(id);
        resolve();
      }, ms);
      this.timers.set(id, resolve);
    });
  }

  /** track an animation (null = reduced-motion no-op) */
  async play(anim: Animation | null | undefined): Promise<void> {
    if (this.dead) return never();
    if (!anim) return;
    this.anims.add(anim);
    if (this.skipped) finish(anim);
    await settled(anim);
    this.anims.delete(anim);
    if (this.dead) return never();
  }

  /** track a count-up */
  async count(c: CountUp): Promise<void> {
    if (this.dead) {
      c.cancel();
      return never();
    }
    this.counts.add(c);
    if (this.skipped) c.cancel();
    await c.done;
    this.counts.delete(c);
    if (this.dead) return never();
  }

  /** run several tracked effects in parallel */
  async all(jobs: Array<Promise<void>>): Promise<void> {
    await Promise.all(jobs);
    if (this.dead) return never();
  }

  skip(): void {
    if (this.skipped || this.dead) return;
    this.skipped = true;
    for (const [id, resolve] of this.timers) {
      clearTimeout(id);
      resolve();
    }
    this.timers.clear();
    for (const a of this.anims) finish(a);
    for (const c of this.counts) c.cancel();
  }

  dispose(): void {
    this.dead = true;
    for (const id of this.timers.keys()) clearTimeout(id);
    this.timers.clear();
    for (const c of this.counts) c.cancel();
    this.counts.clear();
    this.anims.clear();
  }
}

function finish(anim: Animation): void {
  try {
    anim.finish();
  } catch {
    anim.cancel();
  }
}
