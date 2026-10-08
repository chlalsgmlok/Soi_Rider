/**
 * Top-centre story prompt: accent icon tile, title + text, then the keycap [E] inside a draining ring (accent → coral < 30 %).
 * Driven by HudState.prompt every frame; story:resolve plays a success (check) or fail (shake) beat before hiding.
 */
import type { PromptId, PromptState } from '../../core/types/hud';
import type { HudState } from '../../core/types/hud';
import type { HudWidget } from './types';
import { h, s } from '../core/h';
import { icon, setIcon } from '../icons/icon';
import { pop, settled, shake, slideIn, slideOut } from '../core/animate';
import { PROMPT_ICON } from './labels';

const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;

export class PromptBanner implements HudWidget {
  readonly el: HTMLElement;
  private fill = s('circle', { class: 'hud-prompt__ring-fill', cx: 27, cy: 27, r: RING_R, 'stroke-dasharray': RING_C.toFixed(2) });
  private key = h('span.keycap', 'E');
  private glyph = icon('raincoat', 28);
  private title = h('div.hud-prompt__title');
  private text = h('div.hud-prompt__text');
  private id: PromptId | null = null;
  private lastProgress = -1;
  private resolving = false;
  private resolvedId: PromptId | null = null;
  private hideTimer = 0;

  constructor() {
    const ring = s('svg', { class: 'hud-prompt__ring', viewBox: '0 0 54 54', 'aria-hidden': 'true' }, s('circle', { class: 'hud-prompt__ring-track', cx: 27, cy: 27, r: RING_R }), this.fill);
    this.el = h(
      'div.hud-prompt.is-off',
      { role: 'alert' },
      h('div.hud-prompt__icon', this.glyph),
      h('div.hud-prompt__copy', this.title, this.text),
      h('div.hud-prompt__key', ring, this.key),
    );
  }

  /** open (or retarget) the banner — also called directly from the story:prompt event */
  open(p: PromptState): void {
    window.clearTimeout(this.hideTimer);
    this.hideTimer = 0;
    if (p.id === this.id && !this.resolving) return;
    this.id = p.id;
    this.resolving = false;
    this.el.getAnimations().forEach((a) => a.cancel());
    this.el.className = `hud-prompt hud-prompt--${p.id}`;
    this.title.textContent = p.title;
    this.text.textContent = p.text;
    this.key.textContent = p.key.toUpperCase();
    setIcon(this.glyph, PROMPT_ICON[p.id]);
    this.lastProgress = -1;
    this.setProgress(p.progress);
    slideIn(this.el, 'top', { distance: 26, spring: { k: 360, c: 20 } });
    pop(this.key, { from: 0.5, delay: 120 });
  }

  update(st: HudState): void {
    const p = st.prompt;
    // a resolved prompt may linger in HudState for a few frames — never let it re-open the banner
    if (p && p.id === this.resolvedId) return;
    if (!p) this.resolvedId = null;
    if (p) {
      if (p.id !== this.id) this.open(p);
      if (!this.resolving) this.setProgress(p.progress);
    } else if (this.id && !this.resolving && !this.hideTimer) {
      // give story:resolve a moment to arrive so we can play the right ending
      this.hideTimer = window.setTimeout(() => void this.close(), 160);
    }
  }

  resolve(id: PromptId, success: boolean): void {
    if (id !== this.id) return;
    window.clearTimeout(this.hideTimer);
    this.hideTimer = 0;
    this.resolving = true;
    this.resolvedId = id;
    this.el.classList.add(success ? 'is-success' : 'is-fail');
    this.key.replaceChildren(icon(success ? 'check' : 'close', 20));
    this.setProgress(success ? 1 : 0);
    if (success) pop(this.key, { from: 1.5 });
    else shake(this.el, 10);
    this.hideTimer = window.setTimeout(() => void this.close(), success ? 900 : 700);
  }

  private setProgress(v: number): void {
    const p = Math.max(0, Math.min(1, v));
    if (Math.abs(p - this.lastProgress) < 0.004) return;
    this.lastProgress = p;
    this.fill.setAttribute('stroke-dashoffset', (RING_C * (1 - p)).toFixed(2));
    this.el.classList.toggle('is-urgent', p < 0.3 && !this.resolving);
  }

  private async close(): Promise<void> {
    this.hideTimer = 0;
    if (!this.id) return;
    const id = this.id;
    await settled(slideOut(this.el, 'top', 20));
    if (this.id === id) {
      this.id = null;
      this.resolving = false;
      this.el.classList.add('is-off');
      this.el.getAnimations().forEach((a) => a.cancel());
    }
  }

  clear(): void {
    window.clearTimeout(this.hideTimer);
    this.hideTimer = 0;
    this.id = null;
    this.resolving = false;
    this.el.classList.add('is-off');
  }
}
