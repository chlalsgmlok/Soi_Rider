import type { GpuTimer } from '../gpu-timer';

/** One A/B switch: `set(true)` applies the variant, `set(false)` restores the baseline. */
export interface BenchCase {
  name: string;
  set(on: boolean): void;
}

export interface BenchResult {
  name: string;
  /** median GPU ms over every measured frame of this case */
  gpuMs: number;
  /** median GPU ms of the baseline frames */
  baseMs: number;
  frames: number;
}

const median = (v: number[]): number => {
  if (!v.length) return -1;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * In-page GPU benchmark: alternates baseline / case for several rounds (cancels out load from other processes
 * sharing the GPU) and reports the median GPU frame time of each. Drive it with `update(dt)` once per frame.
 */
export class LookdevBench {
  readonly results: BenchResult[] = [];
  done = false;
  private readonly steps: Array<{ caseIndex: number; on: boolean }> = [];
  private step = 0;
  private time = 0;
  private seen = 0;
  private readonly samples = new Map<string, number[]>();

  constructor(
    private readonly gpu: GpuTimer,
    private readonly cases: readonly BenchCase[],
    private readonly settleSec = 0.6,
    private readonly measureSec = 1.4,
    rounds = 3,
  ) {
    for (let r = 0; r < rounds; r++) {
      cases.forEach((_, i) => {
        this.steps.push({ caseIndex: i, on: false }, { caseIndex: i, on: true });
      });
    }
    this.enter();
  }

  update(dt: number): void {
    if (this.done) return;
    this.time += dt;
    const s = this.steps[this.step];
    if (this.time > this.settleSec && this.gpu.samples !== this.seen) {
      const key = s.on ? this.cases[s.caseIndex].name : `base:${this.cases[s.caseIndex].name}`;
      const list = this.samples.get(key) ?? [];
      list.push(this.gpu.lastMs);
      this.samples.set(key, list);
    }
    this.seen = this.gpu.samples;
    if (this.time < this.settleSec + this.measureSec) return;
    if (s.on) this.cases[s.caseIndex].set(false);
    this.step++;
    if (this.step >= this.steps.length) this.finish();
    else this.enter();
  }

  private enter(): void {
    this.time = 0;
    const s = this.steps[this.step];
    if (s.on) this.cases[s.caseIndex].set(true);
  }

  private finish(): void {
    this.done = true;
    for (const c of this.cases) {
      const on = this.samples.get(c.name) ?? [];
      this.results.push({
        name: c.name, gpuMs: median(on), baseMs: median(this.samples.get(`base:${c.name}`) ?? []), frames: on.length,
      });
    }
  }
}
