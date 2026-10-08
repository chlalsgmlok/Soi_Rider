import type { Rng } from '../../core/rng';
import { chase } from '../core/envelope';
import { Voice } from '../core/voice';
import { ching, kick, klong, shaker, snare } from './inst-drums';
import { bass, khaen, phin, ranat } from './inst-melodic';
import { parseHits, parseNotes, STEPS, type Hit, type Note } from './pattern';
import { degreeHz } from './scales';
import type { TrackDef } from './tracks';

type Bars<T> = Array<Array<T | null>>;

interface Parsed {
  kick: Bars<Hit>;
  snare: Bars<Hit>;
  ching: Bars<Hit>;
  shaker: Bars<Hit>;
  klong: Bars<Hit>;
  bass: Bars<Note>;
  lead: Bars<Note>;
  leadAlt: Array<Array<Note | null> | null>;
  breath: number[];
}

const parseCache = new WeakMap<TrackDef, Parsed>();

function parse(d: TrackDef): Parsed {
  const hit = parseCache.get(d);
  if (hit) return hit;
  const p: Parsed = {
    kick: d.kick.map(parseHits), snare: d.snare.map(parseHits), ching: d.ching.map(parseHits),
    shaker: (d.shaker ?? []).map(parseHits), klong: (d.klong ?? []).map(parseHits),
    bass: d.bass.map(parseNotes), lead: d.lead.map(parseNotes),
    leadAlt: (d.leadAlt ?? []).map((s) => (s.trim() ? parseNotes(s) : null)),
    breath: [...d.padBreath].slice(0, STEPS).map((c) => (Number.parseInt(c, 10) || 0) / 9),
  };
  parseCache.set(d, p);
  return p;
}

const at = <T>(bars: Bars<T>, bar: number, step: number): T | null => (bars.length ? bars[bar % bars.length][step] : null);

/**
 * Plays one TrackDef from `t0`: call `pump(until)` to schedule every 16th step that starts before `until`
 * (look-ahead scheduling). Loops re-roll which alternative lead bars to use on every pass.
 */
export class TrackPlayer {
  readonly out: GainNode;
  private readonly p: Parsed;
  private readonly buses: { drums: GainNode; bass: GainNode; lead: GainNode; pad: GainNode };
  private step = 0;
  private next: number;
  private stopAt = Infinity;
  private alt = new Set<number>();
  private readonly send: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    dest: AudioNode,
    echo: AudioNode,
    readonly def: TrackDef,
    private readonly rng: Rng,
    t0: number,
  ) {
    this.p = parse(def);
    this.next = t0;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    const g = (v: number): GainNode => {
      const n = ctx.createGain();
      n.gain.value = v;
      n.connect(this.out);
      return n;
    };
    this.buses = { drums: g(def.mix.drums), bass: g(def.mix.bass), lead: g(def.mix.lead), pad: g(def.mix.pad) };
    this.send = ctx.createGain();
    this.send.gain.value = def.mix.echo;
    this.buses.lead.connect(this.send).connect(echo);
  }

  get stepDur(): number {
    return 60 / this.def.bpm / 4;
  }

  /** length of a non-looping track (stinger) in seconds */
  get length(): number {
    return this.def.bars * STEPS * this.stepDur;
  }

  /** true once nothing more will be scheduled and the last notes have rung out */
  finished(now: number): boolean {
    const end = this.def.loop ? this.stopAt : Math.min(this.stopAt, this.next);
    return this.ended() && now > end + 2.5;
  }

  fade(level: number, t: number, seconds: number): void {
    chase(this.out.gain, level, t, Math.max(0.01, seconds / 3));
  }

  /** stop scheduling new steps from `t` on (already scheduled notes ring out) */
  stop(t: number): void {
    this.stopAt = Math.min(this.stopAt, t);
  }

  pump(until: number): void {
    while (this.next < until && !this.ended()) {
      this.schedule(this.step, this.next);
      this.step++;
      this.next += this.stepDur;
    }
  }

  dispose(): void {
    this.out.disconnect();
    this.send.disconnect();
  }

  private ended(): boolean {
    return this.next >= this.stopAt || (!this.def.loop && this.step >= this.def.bars * STEPS);
  }

  private schedule(i: number, t: number): void {
    const d = this.def;
    const s = i % STEPS;
    const bar = Math.floor(i / STEPS) % d.bars;
    if (s === 0 && bar === 0) this.reroll(Math.floor(i / (STEPS * d.bars)));
    const time = t + (s % 2 === 1 ? d.swing * this.stepDur : 0);

    const k = at(this.p.kick, bar, s);
    const sn = at(this.p.snare, bar, s);
    const ch = at(this.p.ching, bar, s);
    const sh = at(this.p.shaker, bar, s);
    const kl = at(this.p.klong, bar, s);
    if (k || sn || ch || sh || kl) {
      const drums = new Voice(this.ctx, this.buses.drums, this.rng);
      if (k) kick(drums, time, k.alt ? 0.6 : k.vel);
      if (sn) snare(drums, time, sn.vel);
      if (ch) ching(drums, time, ch.alt ? 0.7 : ch.vel * 0.8, ch.alt);
      if (sh) shaker(drums, time, sh.vel);
      if (kl) klong(drums, time, kl.vel, s % 4 !== 0);
      drums.seal();
    }

    const leadBars = this.alt.has(bar) ? this.p.leadAlt[bar] : null;
    const n = leadBars ? leadBars[s] : at(this.p.lead, bar, s);
    if (n) {
      const tones = new Voice(this.ctx, this.buses.lead, this.rng);
      const hz = degreeHz(d.root, d.scale, n.degree);
      const len = n.len * this.stepDur;
      if (d.leadVoice === 'phin') phin(tones, time, hz, len, n.vel, n.slide ? degreeHz(d.root, d.scale, n.degree - 1) : 0);
      else ranat(tones, time, hz, len, n.vel);
      tones.seal();
    }

    const b = at(this.p.bass, bar, s);
    if (b) {
      const low = new Voice(this.ctx, this.buses.bass, this.rng);
      bass(low, time, degreeHz(d.root + d.bassShift, d.scale, b.degree), b.len * this.stepDur, b.vel);
      low.seal();
    }

    const chord = d.pad[bar % d.pad.length];
    if (s === 0 && chord) {
      const pad = new Voice(this.ctx, this.buses.pad, this.rng);
      khaen(pad, time, this.stepDur, chord.map((deg) => degreeHz(d.root, d.scale, deg)), this.p.breath, 1);
      pad.seal();
    }
  }

  private reroll(pass: number): void {
    this.alt.clear();
    if (pass === 0) return;
    this.p.leadAlt.forEach((bar, idx) => {
      if (bar && this.rng.chance(0.45)) this.alt.add(idx);
    });
  }
}
