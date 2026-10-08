import type { EventBus } from '../../core/events';
import type { Rng } from '../../core/rng';
import type { PassengerProfile } from '../../core/types';
import { Chatter } from '../../logic/dialogue';
import type { Situation } from '../../logic/dialogue-lines';
import { isFemalePassenger } from '../../logic/passengers';
import { SpeechGate } from '../../logic/speech-gate';

/**
 * The passenger's mouth: logic's non-repeating Chatter (trait-flavoured lines) behind the SpeechGate cooldowns, out
 * on the bus as 'passenger:say' (the HUD mini-phone shows the bubble, audio may murmur).
 */
export class PassengerVoice {
  private readonly chatter: Chatter;
  private readonly gate = new SpeechGate();

  constructor(rng: Rng, passenger: PassengerProfile, private readonly bus: EventBus) {
    this.chatter = new Chatter(rng, passenger.trait, { female: isFemalePassenger(passenger) });
  }

  /** speaks when the situation's cooldown allows; `now` = run clock (s). True when a line went out. */
  say(situation: Situation, now: number, place?: string): boolean {
    if (!this.gate.allow(situation, now)) return false;
    const line = this.chatter.say(situation, place);
    this.bus.emit('passenger:say', { text: line.text, mood: line.mood });
    return true;
  }
}
