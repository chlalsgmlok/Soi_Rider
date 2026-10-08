/**
 * Centre-screen phase callout ("PICK UP!", "ALMOST THERE") over a sliding crosswalk band.
 * A new callout replaces the current one immediately. ~1.6 s total.
 */
import type { MissionPhase } from '../../core/types/game';
import { h } from '../core/h';
import { reducedMotion } from '../core/motion';
import { springFrames } from '../core/animate';
import { PHASE_CALLOUT } from './labels';

export interface CalloutSpec {
  title: string;
  accent?: string;
  sub?: string;
  tone?: 'info' | 'good' | 'bad';
}

export class Callout {
  readonly el: HTMLElement;
  private band = h('div.hud-callout__band.crosswalk');
  private title = h('div.hud-callout__title');
  private sub = h('div.chip.chip--lg.hud-callout__sub');
  private anims: Animation[] = [];

  constructor() {
    this.el = h('div.hud-callout', { aria: { live: 'assertive' }, hidden: true }, this.band, h('div.hud-callout__inner', this.title, this.sub));
  }

  phase(p: MissionPhase): boolean {
    const spec = PHASE_CALLOUT[p];
    if (!spec) return false;
    this.show(spec);
    return true;
  }

  show(spec: CalloutSpec): void {
    for (const a of this.anims) a.cancel();
    this.title.replaceChildren(spec.title, spec.accent ? ' ' : '', spec.accent ? h('b', spec.accent) : '');
    this.sub.textContent = spec.sub ?? '';
    this.sub.hidden = !spec.sub;
    this.el.className = `hud-callout hud-callout--${spec.tone ?? 'info'}`;
    this.el.hidden = false;
    const total = 1650;
    if (reducedMotion()) {
      this.anims = [this.el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: total, fill: 'forwards' })];
    } else {
      const pop = springFrames((p) => ({ transform: `translateX(${((1 - p) * -90).toFixed(1)}px) skewX(${((1 - p) * -14).toFixed(2)}deg) scale(${(0.7 + 0.3 * p).toFixed(3)})`, opacity: Math.min(1, p * 3) }), { k: 340, c: 17 });
      this.anims = [
        this.band.animate(
          [
            { transform: 'skewY(-2deg) scaleX(0)', transformOrigin: 'left', opacity: 0 },
            { transform: 'skewY(-2deg) scaleX(1)', transformOrigin: 'left', opacity: 1, offset: 0.16 },
            { transform: 'skewY(-2deg) scaleX(1)', transformOrigin: 'right', opacity: 1, offset: 0.8 },
            { transform: 'skewY(-2deg) scaleX(0)', transformOrigin: 'right', opacity: 0 },
          ],
          { duration: total, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
        ),
        this.title.animate(pop.frames, { duration: pop.duration, easing: 'linear', fill: 'backwards' }),
        this.title.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(80px) skewX(-10deg)' }], {
          duration: 240,
          delay: total - 300,
          easing: 'cubic-bezier(.5,0,.75,0)',
          fill: 'forwards',
          composite: 'add',
        }),
        this.sub.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none', offset: 0.2 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], {
          duration: total,
          delay: 120,
          fill: 'both',
        }),
      ];
    }
    const last = this.anims[0];
    last.onfinish = () => {
      if (this.anims[0] === last) this.el.hidden = true;
    };
  }

  clear(): void {
    for (const a of this.anims) a.cancel();
    this.anims = [];
    this.el.hidden = true;
  }
}
