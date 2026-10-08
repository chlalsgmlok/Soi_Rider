import type { Rng } from '../../core/rng';
import { smoothstep } from '../../core/math2d';
import { saturate } from '../core/curves';
import { chase, retarget } from '../core/envelope';
import { NodeBank } from '../core/node-bank';
import { Valve } from '../core/valve';
import { decayShape, firingShape, periodicFromShape } from '../core/periodic';
import type { EngineProfile } from './engine-profiles';

export interface EngineFrame {
  rpm01: number;
  throttle: number;
  load: number;
  speed01: number;
  cut: number;
}

const TC = 0.04;
/** formant bank make-up gain (narrow band-passes of a sparse pulse train are quiet) */
const FORMANT_TRIM = 7;
const LEVEL_TRIM = 0.5;
/** AM depth of the per-firing envelope relative to the noise base level */
const AM_DEPTH = 6;

/**
 * Continuous synth for one engine profile:
 *   firing-pulse osc ─┬─ exhaust formant band-passes ─┐
 *                     └─ direct click ────────────────┼─ drive ─ saturator ─ muffler LPF ─ level ─ out
 *   brown noise ─ breath band ─ ×(per-firing envelope) ┘                        ↑ sub sine (drone/body)
 *   white noise ─ clatter band ─ ×(per-firing envelope) ─────────────────────── level  (valves are not muffled)
 *   triangle whine (CVT belt / chain) ───────────────────────────────────────── level
 *   ultra-slow noise → pitch & amplitude wobble (lopey idle)
 * The output sits behind a valve: a voice that is faded out (engine off, stalled, swapped) costs no CPU.
 */
export class EngineVoice {
  readonly out: GainNode;
  private readonly bank: NodeBank;
  private readonly pulse: OscillatorNode;
  private readonly env: OscillatorNode;
  private readonly sub: OscillatorNode;
  private readonly drive: GainNode;
  private readonly muffler: BiquadFilterNode;
  private readonly level: GainNode;
  private readonly subGain: GainNode;
  private readonly chuff: GainNode;
  private readonly chuffDepth: GainNode;
  private readonly mech: GainNode;
  private readonly mechDepth: GainNode;
  private readonly whine: OscillatorNode | null = null;
  private readonly whineGain: GainNode | null = null;
  private readonly wobble: GainNode;
  private readonly ampWobble: GainNode;
  private readonly valve: Valve;

  constructor(ctx: BaseAudioContext, dest: AudioNode, private readonly p: EngineProfile, rng: Rng) {
    const b = (this.bank = new NodeBank(ctx, rng));
    this.out = b.gain(0);
    this.valve = new Valve(this.out, dest);
    this.level = b.gain(0, this.out);
    this.muffler = b.filter('lowpass', p.muffler, 0.8, this.level);
    this.drive = b.gain(1, b.shaper(saturate(p.grit, p.asym), this.muffler));

    const cyc = p.idleRpm / 120;
    this.pulse = b.osc(cyc, periodicFromShape(ctx, `fire:${p.id}`, firingShape(p.firing, p.pulseWidth), 320));
    const formants = b.gain(FORMANT_TRIM, this.drive);
    for (const f of p.formants) this.pulse.connect(b.filter('bandpass', f.f, f.q, b.gain(f.gain, formants)));
    this.pulse.connect(b.gain(p.click, this.drive));

    this.subGain = b.gain(p.sub, this.muffler);
    this.sub = b.osc(cyc * p.subHarm, 'sine', this.subGain);

    this.env = b.osc(cyc, periodicFromShape(ctx, `env:${p.id}`, decayShape(p.firing, 0.1), 96));
    this.chuff = b.gain(0, this.drive);
    b.noise('brown', 1, b.filter('bandpass', p.chuff.f, p.chuff.q, this.chuff));
    this.chuffDepth = b.gain(0, this.chuff.gain);
    this.env.connect(this.chuffDepth);
    this.mech = b.gain(0, this.level);
    b.noise('white', 1, b.filter('bandpass', p.mech.f, p.mech.q, this.mech));
    this.mechDepth = b.gain(0, this.mech.gain);
    this.env.connect(this.mechDepth);

    if (p.whine) {
      this.whineGain = b.gain(0, this.level);
      this.whine = b.osc(p.whine.base || 200, 'triangle', this.whineGain);
    }

    this.wobble = b.gain(0, this.pulse.detune);
    this.wobble.connect(this.env.detune);
    this.wobble.connect(this.sub.detune);
    this.ampWobble = b.gain(0, this.level.gain);
    const slow = b.filter('lowpass', 6, 0.7, this.wobble);
    slow.connect(this.ampWobble);
    b.noise('brown', 0.04, slow);
  }

  apply(f: EngineFrame, t: number): void {
    const p = this.p;
    const cyc = (p.idleRpm + (p.redRpm - p.idleRpm) * f.rpm01) / 120;
    chase(this.pulse.frequency, cyc, t, TC);
    chase(this.env.frequency, cyc, t, TC);
    chase(this.sub.frequency, cyc * p.subHarm, t, TC);

    const open = f.throttle * (0.45 + 0.55 * f.load);
    const overrun = f.throttle < 0.06 && f.rpm01 > 0.22;
    const bright = (1 + p.brightRpm * f.rpm01 + p.brightLoad * open) * (1 - 0.4 * f.cut) * (overrun ? 0.72 : 1);
    chase(this.muffler.frequency, Math.min(9000, p.muffler * bright), t, TC);
    const drive = 1 + p.grit * (0.2 + 0.8 * open) * (1 - 0.6 * f.cut);
    chase(this.drive.gain, drive, t, TC);

    const loud = (0.42 + 0.58 * Math.pow(f.throttle, 0.7)) * (0.72 + 0.28 * f.rpm01) * (1 - 0.6 * f.cut) * (overrun ? 0.8 : 1);
    const base = (p.level * LEVEL_TRIM * loud) / Math.sqrt(drive);
    chase(this.level.gain, base, t, TC);

    const chuff = p.chuff.gain * (0.3 + 0.7 * open) * (1 - 0.7 * f.cut);
    chase(this.chuff.gain, chuff, t, TC);
    chase(this.chuffDepth.gain, chuff * AM_DEPTH, t, TC);
    const mech = p.mech.gain * (0.35 + 0.65 * f.rpm01);
    chase(this.mech.gain, mech, t, TC);
    chase(this.mechDepth.gain, mech * AM_DEPTH, t, TC);
    chase(this.subGain.gain, p.sub * (0.55 + 0.45 * f.throttle) * (1 - 0.5 * f.cut), t, TC);

    if (this.whine && this.whineGain && p.whine) {
      chase(this.whine.frequency, Math.max(60, p.whine.base + p.whine.perSpeed * f.speed01), t, TC);
      chase(this.whineGain.gain, p.whine.gain * smoothstep(0.02, 0.25, f.speed01) * (0.45 + 0.55 * f.throttle), t, 0.08);
    }
    const idle = (1 - Math.min(1, f.rpm01 * 1.6)) ** 2;
    chase(this.wobble.gain, (p.wobbleCents * idle) / 0.3, t, 0.1);
    chase(this.ampWobble.gain, (base * p.wobbleAmp * idle) / 0.3, t, 0.1);
  }

  /** fade this voice in/out (start, stop, model swap); later calls override pending fades */
  fade(on: boolean, t: number, seconds: number): void {
    retarget(this.out.gain, on ? 1 : 0, t, Math.max(0.01, seconds / 3));
    this.valve.want(on, t, seconds * 2.5 + 0.1);
  }

  /** park the voice once a fade-out has finished */
  tick(now: number): void {
    this.valve.tick(now);
  }

  /** fade out, stop every source and free the graph */
  dispose(t: number): void {
    this.fade(false, t, 0.12);
    this.bank.dispose(t + 0.3);
  }
}
