import type { Rng } from '../../core/rng';
import { smoothstep } from '../../core/math2d';
import { chase } from '../core/envelope';
import { NodeBank } from '../core/node-bank';
import { Valve } from '../core/valve';

const TC = 0.06;
const SQUEAL_HZ = [940, 1325] as const;
/** seconds after a group went silent before its branch is parked */
const TAIL = 0.6;

/**
 * Everything the rider hears that is not the engine: tyre rumble on asphalt, tread hum, helmet wind roar with
 * turbulence, wet-road spray hiss, and tyre squeal + scrub when grip runs out. `set(speedKmh, wet, skid)` per frame.
 * Groups (road, wind, spray, grip) are parked behind valves while silent — standing still costs nothing.
 */
export class RideNoise {
  private readonly bank: NodeBank;
  private readonly rumble: GainNode;
  private readonly hum: GainNode;
  private readonly humBand: BiquadFilterNode;
  private readonly wind: GainNode;
  private readonly windBand: BiquadFilterNode;
  private readonly gust: GainNode;
  private readonly spray: GainNode;
  private readonly squeal: GainNode;
  private readonly squealOsc: OscillatorNode[] = [];
  private readonly scrub: GainNode;
  private readonly valves: { road: Valve; wind: Valve; spray: Valve; grip: Valve };

  constructor(private readonly ctx: BaseAudioContext, dest: AudioNode, rng: Rng) {
    const b = (this.bank = new NodeBank(ctx, rng));
    const brown = b.noise('brown');
    const pink = b.noise('pink');
    const white = b.noise('white');
    const bus = { road: b.gain(1), wind: b.gain(1), spray: b.gain(1), grip: b.gain(1) };
    this.valves = {
      road: new Valve(bus.road, dest), wind: new Valve(bus.wind, dest),
      spray: new Valve(bus.spray, dest), grip: new Valve(bus.grip, dest),
    };

    this.rumble = b.gain(0, bus.road);
    brown.connect(b.filter('lowpass', 150, 0.7, this.rumble));

    this.hum = b.gain(0, bus.road);
    this.humBand = b.filter('bandpass', 300, 1.6, this.hum);
    pink.connect(this.humBand);

    this.wind = b.gain(0, bus.wind);
    this.windBand = b.filter('bandpass', 300, 0.6, this.wind);
    pink.connect(this.windBand);
    this.gust = b.gain(0, this.wind.gain);
    b.noise('brown', 0.08, b.filter('lowpass', 3, 0.7, this.gust));

    this.spray = b.gain(0, bus.spray);
    white.connect(b.filter('highpass', 2200, 0.7, b.filter('lowpass', 9000, 0.7, this.spray)));

    this.squeal = b.gain(0, bus.grip);
    const squealBand = b.filter('bandpass', 1500, 3.5, this.squeal);
    // stick-slip: the squeal pitch jitters with low-passed noise
    const jitter = b.gain(70);
    white.connect(b.filter('lowpass', 28, 0.7, jitter));
    for (const f of SQUEAL_HZ) {
      const o = b.osc(f, 'sawtooth', squealBand);
      jitter.connect(o.frequency);
      this.squealOsc.push(o);
    }
    this.scrub = b.gain(0, bus.grip);
    pink.connect(b.filter('bandpass', 1800, 1, this.scrub));
  }

  /** speedKmh ≥ 0, wet 0..1 (road wetness), skid 0..1 (how far past the grip limit) */
  set(speedKmh: number, wet: number, skid: number, t = this.ctx.currentTime): void {
    const v = Math.max(0, Number.isFinite(speedKmh) ? speedKmh : 0);
    const w = Math.min(1, Math.max(0, wet || 0));
    const s = Math.min(1, Math.max(0, skid || 0)) * smoothstep(2, 9, v);
    chase(this.rumble.gain, Math.min(0.42, 0.3 * (v / 60) ** 1.1), t, TC);
    chase(this.humBand.frequency, 200 + v * 5, t, TC);
    chase(this.hum.gain, 0.08 * Math.min(1.4, v / 60) * (1 - 0.5 * w), t, TC);
    chase(this.windBand.frequency, 240 + v * 9, t, TC);
    const wind = Math.min(0.42, 0.3 * (v / 70) ** 2);
    chase(this.wind.gain, wind, t, TC);
    chase(this.gust.gain, wind * 0.6, t, TC);
    chase(this.spray.gain, 0.22 * w * smoothstep(3, 35, v), t, TC);
    chase(this.squeal.gain, 0.1 * s * (1 - 0.75 * w), t, 0.03);
    chase(this.scrub.gain, 0.16 * s * (0.6 + 0.4 * w), t, 0.03);
    const pitch = 1 + 0.08 * Math.min(1, v / 50);
    this.squealOsc.forEach((o, i) => chase(o.frequency, SQUEAL_HZ[i] * pitch, t, 0.1));
    const V = this.valves;
    V.road.want(v > 0.3, t, TAIL);
    V.wind.want(v > 3, t, TAIL);
    V.spray.want(w > 0 && v > 3, t, TAIL);
    V.grip.want(s > 0, t, TAIL);
    this.tick(t);
  }

  /** park groups whose fade-out has finished */
  tick(now: number): void {
    for (const v of Object.values(this.valves)) v.tick(now);
  }

  dispose(): void {
    for (const v of Object.values(this.valves)) v.dispose();
    this.bank.dispose();
  }
}
