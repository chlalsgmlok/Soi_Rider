import type { EventBus } from '../../core/events';
import type { PromptId } from '../../core/types';
import { StoryArt } from './story-art';
import { type PanelPlace, StoryPanel } from './story-panel';

/** the care prompts that have a story still */
const PROMPT_STILL: Partial<Record<PromptId, string>> = { raincoat: 'story_rain', mask: 'story_haze' };
/** the panel lingers this long after a prompt resolves (ms) */
const LINGER_MS = 1400;

/**
 * The story beats as comic panels (docs/GAME_DESIGN.md §3): the first call at the win stand (intro) and the raincoat
 * / mask hand-overs during a ride. Until `load` finds the story art (blender/story's manifest) every call is a no-op.
 */
export class StoryBeats {
  private readonly panel: StoryPanel;
  private art: StoryArt | null = null;

  constructor(parent: HTMLElement) {
    this.panel = new StoryPanel(parent);
  }

  /** reads the story art manifest (boot) */
  async load(): Promise<void> {
    this.art = await StoryArt.load();
  }

  /** shows still `id`; false when there is no such still */
  show(id: string, place: PanelPlace): boolean {
    const still = this.art?.get(id);
    if (!still) return false;
    this.panel.show(still, place);
    return true;
  }

  hide(afterMs = 0): void {
    this.panel.hide(afterMs);
  }

  /** while riding: a care prompt opens its still, its resolution (or the end of the run) closes it */
  bindPrompts(bus: EventBus): () => void {
    const owner = {};
    bus.on('story:prompt', (p) => {
      const id = PROMPT_STILL[p.id];
      if (id) this.show(id, 'prompt');
    }, owner);
    bus.on('story:resolve', (p) => {
      if (PROMPT_STILL[p.id]) this.hide(LINGER_MS);
    }, owner);
    bus.on('mission:phase', (p) => {
      if (p.phase === 'complete' || p.phase === 'failed') this.hide();
    }, owner);
    return () => {
      bus.offAllOwnedBy(owner);
      this.hide();
    };
  }

  dispose(): void {
    this.panel.dispose();
  }
}
