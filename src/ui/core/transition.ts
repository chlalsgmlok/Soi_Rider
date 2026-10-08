/**
 * Full-screen transitions (DESIGN_SYSTEM §4).
 *  - 'wipe': Crosswalk Wipe — 6 zebra bars (12°) stream in from the left (leading bar on top), hold a beat,
 *    then leave to the right left-most first so the next screen is revealed left → right. A rider zips across.
 *  - 'fade': ink veil.   - 'none': instant.
 * onCovered runs exactly once while the screen is fully covered.
 */
import type { Transition } from '../../core/types/screens';
import { h } from './h';
import { icon } from '../icons/icon';
import { EASE, reducedMotion } from './motion';
import { settled } from './animate';

const BARS = 6;
/** in (130) + stagger (5×16) + hold (30) + out (130) + stagger (5×16) = 450 ms = DUR.wipe (DESIGN_SYSTEM §4) */
const BAR_MS = 130;
const STEP_MS = 16;
const HOLD_MS = 30;

export class Transitions {
  private wipeEl: HTMLElement;
  private bars: HTMLElement[];
  private rider: HTMLElement;
  private veil: HTMLElement;
  private running = false;

  constructor(layer: HTMLElement) {
    this.bars = Array.from({ length: BARS }, (_, i) => h('div.wipe__bar', { style: { '--i': i } }));
    this.rider = h('div.wipe__rider', icon('bike', 44, { stroke: 2.4 }));
    this.wipeEl = h('div.wipe', { hidden: true, aria: { hidden: true } }, this.bars, this.rider);
    this.veil = h('div.fade-veil', { hidden: true, aria: { hidden: true } });
    layer.append(this.wipeEl, this.veil);
  }

  get busy(): boolean {
    return this.running;
  }

  async run(kind: Transition, onCovered?: () => void): Promise<void> {
    if (kind === 'none') {
      onCovered?.();
      return;
    }
    this.running = true;
    try {
      if (kind === 'wipe' && !reducedMotion()) await this.wipe(onCovered);
      else await this.fade(onCovered, kind === 'wipe' ? 140 : 200);
    } finally {
      this.running = false;
    }
  }

  private async wipe(onCovered?: () => void): Promise<void> {
    this.wipeEl.hidden = false;
    const off = (x: string): string => `translateX(${x}) skewX(-12deg)`;
    const total = BAR_MS * 2 + STEP_MS * (BARS - 1) * 2 + HOLD_MS;
    const riderAnim = this.rider.animate(
      [{ transform: 'translate(-12vw, -50%) rotate(-4deg)' }, { transform: 'translate(112vw, -50%) rotate(2deg)' }],
      { duration: total + 80, easing: EASE.inout, fill: 'both' },
    );
    const ins = this.bars.map((bar, i) =>
      bar.animate([{ transform: off('-135vw') }, { transform: off('0px') }], {
        duration: BAR_MS,
        delay: (BARS - 1 - i) * STEP_MS,
        easing: EASE.out,
        fill: 'both',
      }),
    );
    await Promise.all(ins.map(settled));
    try {
      onCovered?.();
    } catch (err) {
      console.error('[ui] transition onCovered failed', err);
    }
    const outs = this.bars.map((bar, i) =>
      bar.animate([{ transform: off('0px') }, { transform: off('135vw') }], {
        duration: BAR_MS,
        delay: HOLD_MS + i * STEP_MS,
        easing: EASE.in,
        fill: 'both',
      }),
    );
    await Promise.all(outs.map(settled));
    for (const a of [...ins, ...outs, riderAnim]) a.cancel();
    this.wipeEl.hidden = true;
  }

  private async fade(onCovered: (() => void) | undefined, half: number): Promise<void> {
    this.veil.hidden = false;
    await settled(this.veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: half, easing: EASE.out, fill: 'forwards' }));
    try {
      onCovered?.();
    } catch (err) {
      console.error('[ui] transition onCovered failed', err);
    }
    const out = this.veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: half * 1.3, easing: EASE.inout, fill: 'forwards' });
    await settled(out);
    out.cancel();
    this.veil.hidden = true;
  }
}
