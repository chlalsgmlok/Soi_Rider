import type { PromptState } from '../../core/types';

/** §7: seconds the player has to stop and hand the raincoat / mask over */
export const PROMPT_WINDOW = 8;

export type CareId = 'raincoat' | 'mask';
const CARE_IDS: readonly CareId[] = ['raincoat', 'mask'];

export type PromptEvent =
  | { kind: 'open'; prompt: PromptState }
  | { kind: 'resolve'; id: CareId; success: boolean }
  /** interact pressed while still rolling — the HUD can nudge "stop first" */
  | { kind: 'needStop'; id: CareId };

export interface PromptInput {
  /** passenger on the bike (offers wait until they are) */
  aboard: boolean;
  /** slower than STOP_SPEED */
  stopped: boolean;
  interact: boolean;
  /** a downpour is running */
  raining: boolean;
  /** a haze spike is running */
  smoggy: boolean;
}

/** idle → pending (event running) → open (8 s window) → given | missed; the next event of the kind re-arms a miss */
type CareState = 'idle' | 'pending' | 'open' | 'missed' | 'given';

const COPY: Record<CareId, { title: string; text: string }> = {
  raincoat: { title: '소나기!', text: '잠깐 멈추고 손님에게 우비 건네기' },
  mask: { title: '매연 주의!', text: '잠깐 멈추고 손님에게 마스크 건네기' },
};

/**
 * Story prompts (docs/GAME_DESIGN.md §3, §7): a downpour offers the raincoat, a haze spike the mask. The offer opens
 * once the passenger is aboard while the weather lasts and succeeds when the player is stopped and presses interact
 * within PROMPT_WINDOW; otherwise it is missed. Pure; the controller turns the events into bus / comfort / stats.
 */
export class StoryPrompts {
  /** the open prompt (progress 1 → 0) or null */
  active: PromptState | null = null;
  private left = 0;
  private readonly state: Record<CareId, CareState> = { raincoat: 'idle', mask: 'idle' };
  private readonly events: PromptEvent[] = [];

  constructor(private readonly key = 'E') {}

  given(id: CareId): boolean {
    return this.state[id] === 'given';
  }

  update(dt: number, i: PromptInput): readonly PromptEvent[] {
    this.events.length = 0;
    const cond: Record<CareId, boolean> = { raincoat: i.raining, mask: i.smoggy };
    for (const id of CARE_IDS) {
      if (cond[id] && this.state[id] === 'idle') this.state[id] = 'pending';
      else if (!cond[id] && (this.state[id] === 'pending' || this.state[id] === 'missed')) this.state[id] = 'idle';
    }
    const open = this.active;
    if (open) {
      const id = open.id as CareId;
      this.left -= dt;
      open.progress = Math.max(0, this.left / PROMPT_WINDOW);
      if (i.interact && i.stopped && i.aboard) this.close(id, true);
      else if (this.left <= 0) this.close(id, false);
      else if (i.interact) this.events.push({ kind: 'needStop', id });
    } else if (i.aboard) {
      const id = CARE_IDS.find((c) => this.state[c] === 'pending' && cond[c]);
      if (id) {
        this.state[id] = 'open';
        this.left = PROMPT_WINDOW;
        this.active = { id, title: COPY[id].title, text: COPY[id].text, key: this.key, progress: 1 };
        this.events.push({ kind: 'open', prompt: { ...this.active } });
      }
    }
    return this.events;
  }

  private close(id: CareId, success: boolean): void {
    this.state[id] = success ? 'given' : 'missed';
    this.active = null;
    this.left = 0;
    this.events.push({ kind: 'resolve', id, success });
  }
}
