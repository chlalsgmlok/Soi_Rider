import type { Situation } from './dialogue-lines';

/**
 * Keeps passenger chatter readable (docs/GAME_DESIGN.md §8): every situation has its own cooldown, ambient remarks also
 * wait a minimum gap after any other line, and story beats (greeting, crashes, raincoat, arrival…) always get through.
 * Times are the run clock in seconds. Typical use:
 * `if (gate.allow('nearMiss', t)) bus.emit('passenger:say', chatter.say('nearMiss'))`.
 */
export interface SpeechRule {
  /** seconds before the same situation may be voiced again (Infinity = once per ride) */
  cooldown: number;
  /** story beats skip the global gap */
  story: boolean;
}

const story = (cooldown: number): SpeechRule => ({ cooldown, story: true });
const ambient = (cooldown: number): SpeechRule => ({ cooldown, story: false });

export const SPEECH_RULES: Readonly<Record<Situation, SpeechRule>> = {
  greet: story(Infinity),
  board: story(Infinity),
  throne: story(Infinity),
  arriveGood: story(Infinity),
  arriveBad: story(Infinity),
  crash: story(4),
  fall: story(3),
  rainStart: story(45),
  raincoatGiven: story(30),
  raincoatMissed: story(30),
  maskGiven: story(30),
  landmark: story(15),
  nearMiss: ambient(7),
  harshBrake: ambient(6),
  smooth: ambient(35),
  slowTraffic: ambient(25),
  counterflow: ambient(10),
  sidewalk: ambient(10),
  hurry: ambient(18),
  heat: ambient(20),
  haze: ambient(20),
  waiting: ambient(15),
};

/** minimum seconds between an ambient remark and the previous line of any kind */
export const SPEECH_GAP = 2.5;

export class SpeechGate {
  private readonly last = new Map<Situation, number>();
  private lastAny = -Infinity;

  constructor(
    private readonly rules: Readonly<Record<Situation, SpeechRule>> = SPEECH_RULES,
    readonly gap: number = SPEECH_GAP,
  ) {}

  /** whether the passenger may voice `situation` at run time `now` (no side effects) */
  canSay(situation: Situation, now: number): boolean {
    const rule = this.rules[situation];
    const prev = this.last.get(situation);
    if (prev !== undefined && !(now - prev >= rule.cooldown)) return false;
    return rule.story || now - this.lastAny >= this.gap;
  }

  /** checks and, when allowed, records the line as spoken */
  allow(situation: Situation, now: number): boolean {
    if (!this.canSay(situation, now)) return false;
    this.last.set(situation, now);
    this.lastAny = now;
    return true;
  }

  /** forget everything (restart / next passenger) */
  reset(): void {
    this.last.clear();
    this.lastAny = -Infinity;
  }
}
