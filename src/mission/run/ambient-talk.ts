import type { Situation } from '../../logic/dialogue-lines';
import type { PassengerVoice } from './passenger-voice';

/** What the passenger notices about the ride right now. */
export interface TalkInput {
  /** on the bike */
  aboard: boolean;
  /** still waiting at the pickup (they text the rider through gram) */
  waiting: boolean;
  /** the rider is taking longer to the pickup than gram estimated */
  approachLate: boolean;
  speed: number;
  counterflow: boolean;
  sidewalk: boolean;
  /** behind the ETA */
  late: boolean;
  /** the trait is 'hurry' */
  hurried: boolean;
  /** baking in the midday sun while stopped */
  hot: boolean;
  /** breathing smog without a mask */
  smog: boolean;
  /** seconds since the last comfort loss */
  calmFor: number;
}

type Rule = readonly [situation: Situation, active: (i: TalkInput) => boolean, holdSec: number];

/** each situation speaks once its condition has held for `holdSec` (SpeechGate cooldowns stop repeats) */
const RULES: readonly Rule[] = [
  ['counterflow', (i) => i.aboard && i.counterflow, 1.2],
  ['sidewalk', (i) => i.aboard && i.sidewalk, 1],
  ['haze', (i) => i.aboard && i.smog, 3],
  ['heat', (i) => i.aboard && i.hot, 6],
  ['hurry', (i) => i.aboard && (i.late || (i.hurried && Math.abs(i.speed) < 3)), 6],
  ['slowTraffic', (i) => i.aboard && Math.abs(i.speed) < 1.5, 9],
  ['smooth', (i) => i.aboard && i.calmFor > 22 && i.speed > 4, 0],
  ['waiting', (i) => i.waiting && i.approachLate, 4],
];

/** Situational chatter (docs/GAME_DESIGN.md §8 personalities): rate-limited remarks about how the ride is going. */
export class AmbientTalk {
  private readonly held = new Float64Array(RULES.length);

  update(dt: number, now: number, i: TalkInput, voice: PassengerVoice): void {
    for (let k = 0; k < RULES.length; k++) {
      const [situation, active, hold] = RULES[k];
      if (!active(i)) {
        this.held[k] = 0;
        continue;
      }
      this.held[k] += dt;
      if (this.held[k] >= hold && voice.say(situation, now)) this.held[k] = 0;
    }
  }
}
