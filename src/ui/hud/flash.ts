/** Screen-edge vignette flash: coral on hits, amber on mirror clips, cyan on perfect gaps. */
import type { Tone } from '../../core/events';
import { h } from '../core/h';
import { reducedMotion } from '../core/motion';

const COLOR: Record<Tone, string> = {
  info: 'rgba(62,230,212,.55)',
  good: 'rgba(52,176,74,.5)',
  warn: 'rgba(255,178,62,.55)',
  bad: 'rgba(255,77,94,.7)',
};

export class EdgeFlash {
  readonly el = h('div.hud-flash', { aria: { hidden: true } });
  private anim: Animation | null = null;

  flash(tone: Tone, strength = 1): void {
    this.anim?.cancel();
    this.el.style.setProperty('--flash', COLOR[tone]);
    const peak = Math.max(0.15, Math.min(1, strength)) * (reducedMotion() ? 0.5 : 1);
    this.anim = this.el.animate([{ opacity: 0 }, { opacity: peak, offset: 0.12 }, { opacity: 0 }], {
      duration: tone === 'bad' ? 620 : 480,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    });
  }
}
