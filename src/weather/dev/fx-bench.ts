export interface FxBenchResult {
  /** median GPU ms per frame with the weather FX on / off, and the difference */
  onMs: number;
  offMs: number;
  deltaMs: number;
  samples: number;
}

const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : -1;
};

/**
 * Interleaved A/B of the weather FX cost: toggles the FX every `phaseFrames` frames and collects raw GPU timer
 * samples per state (skipping the frames right after a toggle, whose queries straddle it). Interleaving cancels
 * out drift and other load on a shared GPU.
 */
export class FxBench {
  done = false;
  private readonly on: number[] = [];
  private readonly off: number[] = [];
  private state = true;
  private frame = 0;
  private phase = 0;
  private seen = -1;

  constructor(private readonly toggle: (on: boolean) => void, private readonly phases = 24, private readonly phaseFrames = 24) {
    toggle(true);
  }

  /** once per rendered frame: the GPU timer's sample counter and latest raw sample */
  sample(samples: number, lastMs: number): void {
    if (this.done) return;
    if (this.seen >= 0 && samples > this.seen && this.frame > 6 && lastMs > 0) (this.state ? this.on : this.off).push(lastMs);
    this.seen = samples;
    if (++this.frame < this.phaseFrames) return;
    this.frame = 0;
    this.state = !this.state;
    this.toggle(this.state);
    if (++this.phase >= this.phases) {
      this.done = true;
      this.toggle(true);
    }
  }

  result(): FxBenchResult {
    const onMs = median(this.on);
    const offMs = median(this.off);
    return { onMs: +onMs.toFixed(3), offMs: +offMs.toFixed(3), deltaMs: +(onMs - offMs).toFixed(3), samples: this.on.length + this.off.length };
  }
}
