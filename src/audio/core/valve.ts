/**
 * Output switch for a long-lived branch. WebAudio renders by pulling from the destination, so a branch whose
 * output is disconnected costs no CPU at all — a silent rain bed, a parked engine or an unused horn are free.
 * `want(true)` opens at once; `want(false, t, tail)` closes `tail` seconds later (after the fade-out has
 * finished), performed by `tick(now)`. Starts closed.
 */
export class Valve {
  private open = false;
  private closeAt = Infinity;

  constructor(private readonly node: AudioNode, private readonly dest: AudioNode) {}

  get isOpen(): boolean {
    return this.open;
  }

  want(audible: boolean, t: number, tail = 0.5): void {
    if (audible) {
      this.closeAt = Infinity;
      if (!this.open) {
        this.node.connect(this.dest);
        this.open = true;
      }
    } else if (this.open && this.closeAt === Infinity) {
      this.closeAt = t + Math.max(0, tail);
    }
  }

  tick(now: number): void {
    if (!this.open || now < this.closeAt) return;
    this.node.disconnect(this.dest);
    this.open = false;
    this.closeAt = Infinity;
  }

  dispose(): void {
    if (this.open) this.node.disconnect(this.dest);
    this.open = false;
  }
}
