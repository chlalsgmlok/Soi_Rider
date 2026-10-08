/** Passenger speech bubble above the mini-phone: say(text, mood) pops it in, auto-hides by text length. */
import type { Mood } from '../../core/events';
import { h } from '../core/h';
import { icon, setIcon } from '../icons/icon';
import { bump, pop, popOut, settled } from '../core/animate';
import { MOOD_ICON } from './labels';

export class SpeechBubble {
  readonly el: HTMLElement;
  private text = h('span.speech__text');
  private glyph = icon('smile', 14);
  private bubble = h('div.speech', h('span.speech__mood', this.glyph), this.text);
  private timer = 0;
  private shown = false;

  constructor() {
    this.el = h('div.hud-say.is-off', { role: 'status', aria: { live: 'polite' } }, this.bubble);
  }

  say(text: string, mood: Mood = 'neutral'): void {
    window.clearTimeout(this.timer);
    this.text.textContent = text;
    setIcon(this.glyph, MOOD_ICON[mood]);
    this.bubble.className = `speech speech--${mood}`;
    if (this.shown) bump(this.el, 0.08);
    else {
      this.shown = true;
      this.el.classList.remove('is-off');
      pop(this.el, { from: 0.6, spring: { k: 420, c: 16 } });
    }
    this.timer = window.setTimeout(() => void this.hide(), Math.min(6000, 2400 + text.length * 70));
  }

  async hide(): Promise<void> {
    window.clearTimeout(this.timer);
    if (!this.shown) return;
    this.shown = false;
    const a = popOut(this.el, { to: 0.85 });
    await settled(a);
    if (!this.shown) this.el.classList.add('is-off');
    a.cancel();
  }
}
