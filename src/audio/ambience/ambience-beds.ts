import type { Rng } from '../../core/rng';
import { chase } from '../core/envelope';
import { rectifier } from '../core/curves';
import { NodeBank } from '../core/node-bank';
import { chirpShape, periodicFromShape } from '../core/periodic';
import { Valve } from '../core/valve';
import type { AmbienceLevels } from '../types';

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * Continuous ambience layers, all running from construction at zero level:
 *  city  — distant traffic rumble + city air + slow traffic swells
 *  rain  — high hiss, heavy-rain body, drop crackle on asphalt, fat drops on awnings
 *  wind  — band of noise whose centre and level drift (gusts)
 *  night — cicada choir (46 Hz buzz, swelling) + two crickets chirping at different rates
 * Each group sits behind a valve, so beds at zero level cost no CPU.
 */
export class AmbienceBeds {
  readonly levels: AmbienceLevels = { city: 0, rain: 0, wind: 0, night: 0 };
  private readonly bank: NodeBank;
  private readonly cityRumble: GainNode;
  private readonly cityAir: GainNode;
  private readonly swell: GainNode;
  private readonly rainHiss: GainNode;
  private readonly rainBody: GainNode;
  private readonly rainCrackle: GainNode;
  private readonly rainDrops: GainNode;
  private readonly wind: GainNode;
  private readonly gust: GainNode;
  private readonly cicadas: GainNode;
  private readonly crickets: GainNode;
  private readonly valves: Record<keyof AmbienceLevels, Valve>;
  private nextSwell = 0;

  constructor(ctx: BaseAudioContext, dest: AudioNode, private readonly rng: Rng) {
    const b = (this.bank = new NodeBank(ctx, rng));
    const brown = b.noise('brown');
    const pink = b.noise('pink');
    const white = b.noise('white');
    const bus = { city: b.gain(1), rain: b.gain(1), wind: b.gain(1), night: b.gain(1) };
    this.valves = {
      city: new Valve(bus.city, dest), rain: new Valve(bus.rain, dest),
      wind: new Valve(bus.wind, dest), night: new Valve(bus.night, dest),
    };

    this.cityRumble = b.gain(0, bus.city);
    brown.connect(b.filter('lowpass', 320, 0.7, this.cityRumble));
    this.cityAir = b.gain(0, bus.city);
    pink.connect(b.filter('bandpass', 900, 0.5, this.cityAir));
    this.swell = b.gain(0, bus.city);
    pink.connect(b.filter('bandpass', 480, 0.8, this.swell));

    this.rainHiss = b.gain(0, bus.rain);
    white.connect(b.filter('highpass', 1800, 0.7, b.filter('lowpass', 10000, 0.7, this.rainHiss)));
    this.rainBody = b.gain(0, bus.rain);
    pink.connect(b.filter('lowpass', 900, 0.7, this.rainBody));
    this.rainCrackle = b.gain(0, bus.rain);
    b.noise('crackle', 1, b.filter('bandpass', 3000, 0.8, this.rainCrackle));
    this.rainDrops = b.gain(0, bus.rain);
    b.noise('drops', 1, b.filter('highpass', 1200, 0.7, this.rainDrops));

    this.wind = b.gain(0, bus.wind);
    const windBand = b.filter('bandpass', 420, 1.1, this.wind);
    pink.connect(windBand);
    const slow = b.filter('lowpass', 0.8, 0.7);
    b.noise('brown', 0.05, slow);
    slow.connect(b.gain(260, windBand.frequency));
    this.gust = b.gain(0, this.wind.gain);
    slow.connect(this.gust);

    this.cicadas = b.gain(0, bus.night);
    const buzz = b.gain(0.5, this.cicadas);
    white.connect(b.filter('bandpass', 5200, 7, buzz));
    b.osc(46, 'square', b.gain(0.5, buzz.gain));
    slow.connect(b.gain(0.35, buzz.gain));

    this.crickets = b.gain(0, bus.night);
    const gate = rectifier();
    for (const [hz, rate] of [[4400, 1.6], [4870, 1.27]] as const) {
      const chirp = b.gain(0, this.crickets);
      b.osc(hz, 'sine', chirp);
      const env = b.osc(rate, periodicFromShape(ctx, 'chirp3', chirpShape(3, 0.06, 0.012), 128));
      env.connect(b.shaper(gate, chirp.gain));
    }
  }

  set(l: Partial<AmbienceLevels>, rampSec: number, t: number): void {
    const L = this.levels;
    if (l.city !== undefined) L.city = clamp01(l.city);
    if (l.rain !== undefined) L.rain = clamp01(l.rain);
    if (l.wind !== undefined) L.wind = clamp01(l.wind);
    if (l.night !== undefined) L.night = clamp01(l.night);
    const tc = Math.max(0.05, rampSec / 3);
    // heavy rain masks the city a little
    const city = L.city * (1 - 0.35 * L.rain);
    chase(this.cityRumble.gain, 0.2 * city, t, tc);
    chase(this.cityAir.gain, 0.05 * city * (1 - 0.3 * L.night), t, tc);
    chase(this.rainHiss.gain, 0.16 * L.rain ** 0.8, t, tc);
    chase(this.rainBody.gain, 0.22 * L.rain ** 1.5, t, tc);
    chase(this.rainCrackle.gain, 0.3 * L.rain, t, tc);
    chase(this.rainDrops.gain, 0.18 * L.rain, t, tc);
    chase(this.wind.gain, 0.22 * L.wind, t, tc);
    chase(this.gust.gain, 0.18 * L.wind, t, tc);
    const insects = L.night * (1 - 0.8 * L.rain);
    chase(this.cicadas.gain, 0.05 * insects, t, tc);
    chase(this.crickets.gain, 0.03 * insects, t, tc);
    const tail = tc * 7 + 0.2;
    this.valves.city.want(city > 0, t, tail);
    this.valves.rain.want(L.rain > 0, t, tail);
    this.valves.wind.want(L.wind > 0, t, tail);
    this.valves.night.want(insects > 0, t, tail);
  }

  /** slow random traffic swells (waves of cars released by distant signals) */
  drift(t: number): void {
    for (const v of Object.values(this.valves)) v.tick(t);
    if (t < this.nextSwell) return;
    const city = this.levels.city * (1 - 0.35 * this.levels.rain);
    chase(this.swell.gain, city * (0.02 + this.rng.next() * 0.1), t, 1.2 + this.rng.next() * 2);
    this.nextSwell = t + 2 + this.rng.next() * 5;
  }

  dispose(): void {
    for (const v of Object.values(this.valves)) v.dispose();
    this.bank.dispose();
  }
}
