import type { Rng } from '../../core/rng';
import { NodeBank } from '../core/node-bank';
import type { Clock, MusicTrack, StingerName } from '../types';
import { TrackPlayer } from './track-player';
import { STINGERS, TRACKS } from './tracks';

/** how far ahead steps are scheduled (s) — covers timer jitter of the 25 ms audio clock */
const LOOKAHEAD = 0.2;

/**
 * Music director: crossfades between looping tracks, fires stingers over a ducked bed, and owns the molam
 * slap-back echo (dotted-eighth, darkened feedback) that the phin / ranat lines are sent into.
 */
export class MusicPlayer {
  private current: TrackPlayer | null = null;
  private name: MusicTrack | null = null;
  private tails: TrackPlayer[] = [];
  private readonly bank: NodeBank;
  private readonly echoIn: GainNode;
  private readonly echoDelay: DelayNode;
  private serial = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly bus: AudioNode,
    /** post-duck input: stingers stay loud while the bed ducks under them */
    private readonly stingBus: AudioNode,
    private readonly rng: Rng,
    private readonly clock: Clock,
    private readonly duck: (amount: number, seconds: number) => void,
  ) {
    const b = (this.bank = new NodeBank(ctx, rng));
    this.echoIn = b.gain(1);
    this.echoDelay = ctx.createDelay(2);
    this.echoDelay.delayTime.value = 0.33;
    const dark = b.filter('lowpass', 2600, 0.7);
    const thin = b.filter('highpass', 350, 0.7, dark);
    this.echoIn.connect(this.echoDelay).connect(thin);
    dark.connect(b.gain(0.33, this.echoDelay));
    dark.connect(bus);
  }

  get track(): MusicTrack | null {
    return this.name;
  }

  /** crossfade to `next` (null = fade to silence); the same track keeps playing */
  play(next: MusicTrack | null, fade = 1.2): void {
    if (next === this.name) return;
    const t = this.clock();
    const f = Math.max(0.05, fade);
    if (this.current) {
      this.current.fade(0, t, f);
      this.current.stop(t + f);
      this.tails.push(this.current);
      this.current = null;
    }
    this.name = next;
    if (!next) return;
    const def = TRACKS[next];
    const p = new TrackPlayer(this.ctx, this.bus, this.echoIn, def, this.rng.fork(`${next}:${this.serial++}`), t + 0.06);
    p.fade(1, t, f * 0.7);
    this.echoDelay.delayTime.setTargetAtTime((60 / def.bpm) * 0.75, t, 0.05);
    this.current = p;
  }

  /** one-shot musical sting over the ducked bed */
  stinger(name: StingerName): void {
    const def = STINGERS[name];
    if (!def) return;
    const t = this.clock();
    const p = new TrackPlayer(this.ctx, this.stingBus, this.echoIn, def, this.rng.fork(`sting:${this.serial++}`), t + 0.03);
    p.fade(1, t, 0.01);
    this.tails.push(p);
    this.duck(0.8, p.length + 0.4);
  }

  /** schedule ahead; call every ~25 ms with the audio clock */
  tick(now: number): void {
    const until = now + LOOKAHEAD;
    this.current?.pump(until);
    for (const p of this.tails) p.pump(until);
    if (this.tails.some((p) => p.finished(now))) {
      for (const p of this.tails) if (p.finished(now)) p.dispose();
      this.tails = this.tails.filter((p) => !p.finished(now));
    }
  }

  dispose(): void {
    this.current?.dispose();
    for (const p of this.tails) p.dispose();
    this.tails = [];
    this.current = null;
    this.bank.dispose();
    this.echoDelay.disconnect();
  }
}
