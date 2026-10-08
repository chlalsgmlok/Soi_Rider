import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CountUp } from '../../core/count-up';
import { Sequencer } from './sequencer';

/** minimal WAAPI stand-in: `finished` settles when finish() / cancel() is called */
class FakeAnim {
  finishes = 0;
  cancels = 0;
  readonly finished: Promise<void>;
  private resolve: () => void = () => undefined;
  private reject: (e: Error) => void = () => undefined;
  constructor() {
    this.finished = new Promise<void>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
  finish(): void {
    this.finishes++;
    this.resolve();
  }
  cancel(): void {
    this.cancels++;
    this.reject(new Error('cancelled'));
  }
  get anim(): Animation {
    return this as unknown as Animation;
  }
}

function fakeCount(): CountUp & { cancels: number; land(): void } {
  let land: () => void = () => undefined;
  const done = new Promise<void>((res) => (land = res));
  const c = {
    cancels: 0,
    done,
    land: () => land(),
    cancel() {
      c.cancels++;
      land();
    },
  };
  return c;
}

/** resolves on the next macrotask (lets awaited chains advance) */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('Sequencer (skippable reward choreography)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('wait() resolves after its delay; skip() resolves every pending wait at once', async () => {
    const seq = new Sequencer();
    const log: string[] = [];
    void seq.wait(300).then(() => log.push('a'));
    void seq.wait(5000).then(() => log.push('b'));
    await vi.advanceTimersByTimeAsync(299);
    expect(log).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(log).toEqual(['a']);
    seq.skip();
    await flush();
    expect(log).toEqual(['a', 'b']);
    expect(seq.fast).toBe(true);
  });

  it('after skip(), new waits are instant and new animations / count-ups start finished', async () => {
    const seq = new Sequencer();
    seq.skip();
    let waited = false;
    void seq.wait(10_000).then(() => (waited = true));
    await flush();
    expect(waited).toBe(true);

    const a = new FakeAnim();
    await seq.play(a.anim);
    expect(a.finishes).toBe(1);

    const c = fakeCount();
    await seq.count(c);
    expect(c.cancels).toBe(1);
  });

  it('skip() finishes tracked animations and jumps tracked count-ups to their end', async () => {
    const seq = new Sequencer();
    const a = new FakeAnim();
    const c = fakeCount();
    let played = false;
    let counted = false;
    void seq.play(a.anim).then(() => (played = true));
    void seq.count(c).then(() => (counted = true));
    await flush();
    expect(played || counted).toBe(false);
    seq.skip();
    await flush();
    expect(a.finishes).toBe(1);
    expect(c.cancels).toBe(1);
    expect(played && counted).toBe(true);
  });

  it('a whole chain fast-forwards to its last step on skip()', async () => {
    const seq = new Sequencer();
    const steps: string[] = [];
    const chain = (async () => {
      await seq.wait(400);
      steps.push('slip');
      await seq.play(new FakeAnim().anim);
      steps.push('stamp');
      await seq.wait(800);
      steps.push('done');
    })();
    await vi.advanceTimersByTimeAsync(400);
    expect(steps).toEqual(['slip']);
    seq.skip();
    await chain;
    expect(steps).toEqual(['slip', 'stamp', 'done']);
  });

  it('a cancelled animation counts as settled', async () => {
    const seq = new Sequencer();
    const a = new FakeAnim();
    const p = seq.play(a.anim);
    a.cancel();
    await expect(p).resolves.toBeUndefined();
  });

  it('dispose() stops the chain: pending and later steps never resolve, running count-ups are cancelled', async () => {
    const seq = new Sequencer();
    const steps: string[] = [];
    const c = fakeCount();
    void (async () => {
      await seq.wait(200);
      steps.push('after-wait');
    })();
    void seq.count(c).then(() => steps.push('after-count'));
    seq.dispose();
    expect(c.cancels).toBe(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(steps).toEqual([]);
    expect(seq.disposed).toBe(true);

    let late = false;
    void seq.wait(0).then(() => (late = true));
    void seq.play(new FakeAnim().anim).then(() => (late = true));
    seq.skip();
    await vi.advanceTimersByTimeAsync(1000);
    expect(late).toBe(false);
    expect(seq.fast).toBe(false);
  });
});
