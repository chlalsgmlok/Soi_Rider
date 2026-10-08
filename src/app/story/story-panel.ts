import { h } from '../../ui';
import type { StoryStill } from './story-art';
import './story-panel.css';

/** intro = under the TRIP title beside the gram phone · prompt = under the HUD trip tag during a care prompt */
export type PanelPlace = 'intro' | 'prompt';

/**
 * A small comic panel with a story still and its caption (docs/GAME_DESIGN.md §3 story beats), shown at the first
 * call and during the raincoat / mask moments. Decorative (aria-hidden): the screens carry the same words.
 * It appears only once its image has loaded, so a still listed in the manifest but not rendered yet never shows broken.
 */
export class StoryPanel {
  readonly el: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly cap: HTMLElement;
  private timer = 0;
  /** the panel should be up (an image that finishes loading late only shows while this holds) */
  private wanted = false;

  constructor(parent: HTMLElement) {
    this.img = h('img.story-panel__img', { alt: '', decoding: 'async' }) as HTMLImageElement;
    this.cap = h('figcaption.story-panel__cap');
    this.el = h('figure.story-panel', { aria: { hidden: true } }, this.img, this.cap);
    this.img.addEventListener('load', () => this.reveal());
    parent.append(this.el);
  }

  show(still: StoryStill, place: PanelPlace): void {
    window.clearTimeout(this.timer);
    this.wanted = true;
    this.el.dataset.place = place;
    this.cap.textContent = still.caption;
    if (this.img.getAttribute('src') !== still.thumb) {
      this.el.classList.remove('is-shown');
      this.img.setAttribute('src', still.thumb);
    } else this.reveal();
  }

  hide(afterMs = 0): void {
    window.clearTimeout(this.timer);
    const off = (): void => {
      this.wanted = false;
      this.el.classList.remove('is-shown');
    };
    if (afterMs <= 0) off();
    else this.timer = window.setTimeout(off, afterMs);
  }

  dispose(): void {
    window.clearTimeout(this.timer);
    this.el.remove();
  }

  /** a decoded image is up: show it if still wanted (a failed load leaves the panel hidden) */
  private reveal(): void {
    if (this.wanted && this.img.complete && this.img.naturalWidth > 0) this.el.classList.add('is-shown');
  }
}
