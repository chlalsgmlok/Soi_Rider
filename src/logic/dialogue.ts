import type { Mood } from '../core/events';
import type { Rng } from '../core/rng';
import type { PassengerTrait } from '../core/types';
import { LINES, type LineDef, type Situation } from './dialogue-lines';

/** Passenger speech (docs/GAME_DESIGN.md §8 personalities). Emit the result as GameEvents['passenger:say']. */

export interface SpokenLine {
  text: string;
  mood: Mood;
}

export interface SayContext {
  /** selects the polite particle 카 / 캅 and a regular's self-reference 이모 / 삼촌 (female / male); default female */
  female?: boolean;
  /** landmark name for {place}; default "저기" */
  place?: string;
}

/** chance of using a trait-specific line when the situation has some for the trait */
export const TRAIT_LINE_CHANCE = 0.6;

export const SITUATIONS = Object.keys(LINES) as Situation[];

function render([text, mood]: LineDef, ctx: SayContext): SpokenLine {
  const male = ctx.female === false;
  return {
    text: text
      .replaceAll('{kha}', male ? '캅' : '카')
      .replaceAll('{imo}', male ? '삼촌' : '이모')
      .replaceAll('{place}', ctx.place ?? '저기'),
    mood,
  };
}

/** one line for a situation; tone follows the passenger trait */
export function say(rng: Rng, situation: Situation, trait: PassengerTrait, ctx: SayContext = {}): SpokenLine {
  const pool = LINES[situation];
  const traitLines = pool.trait?.[trait];
  const lines = traitLines && traitLines.length > 0 && rng.chance(TRAIT_LINE_CHANCE) ? traitLines : pool.base;
  return render(rng.pick(lines), ctx);
}

/**
 * Per-passenger speaker that never repeats a line until every variant of that situation has been heard
 * (shuffled deck of base + trait lines, refilled without an immediate repeat across the reshuffle).
 */
export class Chatter {
  private readonly decks = new Map<Situation, LineDef[]>();
  private readonly last = new Map<Situation, LineDef>();

  constructor(
    private readonly rng: Rng,
    readonly trait: PassengerTrait,
    private readonly ctx: SayContext = {},
  ) {}

  say(situation: Situation, place?: string): SpokenLine {
    let deck = this.decks.get(situation);
    if (!deck || deck.length === 0) {
      const pool = LINES[situation];
      deck = this.rng.shuffle([...pool.base, ...(pool.trait?.[this.trait] ?? [])]);
      const prev = this.last.get(situation);
      const top = deck.length - 1;
      if (top > 0 && deck[top] === prev) [deck[0], deck[top]] = [deck[top], deck[0]];
      this.decks.set(situation, deck);
    }
    const line = deck.pop() ?? LINES[situation].base[0];
    this.last.set(situation, line);
    return render(line, place === undefined ? this.ctx : { ...this.ctx, place });
  }
}
