import type { Rng } from '../../core/rng';
import { hold, retarget } from '../core/envelope';
import { NodeBank } from '../core/node-bank';
import { Valve } from '../core/valve';
import type { Clock } from '../types';
import { HORN_SPECS, MEEP_MEEP } from './horn-specs';
import { hornChain } from './horn-tone';

const SPEC = HORN_SPECS.player;
/** shortest blast when the key is only tapped */
const MIN_HOLD = 0.08;
/** a tap right after a held press (or vice versa) is the same press — don't double up */
const SAME_PRESS = 0.25;
/** park the horn chain this long after the last blast */
const TAIL = 0.4;

/**
 * The rider's scooter horn. `set(true/false)` follows a held key (continuous "meeeep", spin-up pitch bend);
 * `tap()` plays the classic "meep-meep" and is ignored while the held horn sounds. The chain is parked behind a
 * valve between honks, so an idle horn costs no CPU.
 */
export class PlayerHorn {
  private readonly bank: NodeBank;
  private readonly amp: GainNode;
  private readonly oscs: OscillatorNode[] = [];
  private readonly chainNodes: AudioNode[];
  private readonly valve: Valve;
  private held = false;
  private heldAt = -9;
  private tapAt = -9;

  constructor(ctx: BaseAudioContext, dest: AudioNode, rng: Rng, private readonly clock: Clock) {
    this.bank = new NodeBank(ctx, rng);
    const out = this.bank.gain(1);
    this.valve = new Valve(out, dest);
    const chain = hornChain(ctx, SPEC, out);
    this.amp = this.bank.gain(0, chain.input);
    for (const f of SPEC.freqs) this.oscs.push(this.bank.osc(f, SPEC.wave, this.bank.gain(SPEC.level / Math.SQRT2, this.amp)));
    this.chainNodes = chain.nodes;
  }

  get sounding(): boolean {
    return this.held;
  }

  set(on: boolean): void {
    const t = this.clock();
    if (on === this.held) return;
    this.held = on;
    if (on) {
      this.heldAt = t;
      this.valve.want(true, t);
      retarget(this.amp.gain, 1, t, 0.003);
      this.bend(t);
    } else {
      const off = Math.max(t, this.heldAt + MIN_HOLD);
      retarget(this.amp.gain, 0, off, SPEC.release / 3);
      this.valve.want(false, off, TAIL);
    }
  }

  tap(): void {
    const t = this.clock();
    if (this.held || t - this.heldAt < SAME_PRESS || t - this.tapAt < SAME_PRESS) return;
    this.tapAt = t;
    this.valve.want(true, t);
    const last = MEEP_MEEP[MEEP_MEEP.length - 1];
    this.valve.want(false, t + last[0] + last[1], TAIL);
    const g = this.amp.gain;
    hold(g, t);
    for (const [s, d] of MEEP_MEEP) {
      g.setTargetAtTime(1, t + s, 0.003);
      g.setTargetAtTime(0, t + s + d, SPEC.release / 3);
      this.bend(t + s);
    }
  }

  /** park the chain once the last blast has rung out */
  tick(now: number): void {
    this.valve.tick(now);
  }

  dispose(): void {
    this.valve.dispose();
    this.bank.dispose();
    for (const n of this.chainNodes) n.disconnect();
  }

  private bend(t: number): void {
    SPEC.freqs.forEach((f, i) => {
      const fr = this.oscs[i].frequency;
      fr.cancelScheduledValues(t);
      fr.setValueAtTime(f * (1 - SPEC.bend), t);
      fr.linearRampToValueAtTime(f, t + 0.04);
    });
  }
}
