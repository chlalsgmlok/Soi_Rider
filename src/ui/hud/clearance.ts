/**
 * World-anchored clearance brackets "( 6 cm )" beside the bike (mockup 02). One per side, positioned at
 * HudState.clearance.{left,right}Screen; colour bands 30+ cyan · 10–30 amber · < 10 coral with a pulse that
 * speeds up as the gap closes. Per-frame cost: one transform write per visible side (skipped if < 0.5 px).
 */
import type { HudState } from '../../core/types/hud';
import type { ScreenPoint } from '../../core/types/geometry';
import type { HudWidget } from './types';
import { h, s } from '../core/h';
import { gapBand } from './format';

const bracket = (open: boolean): SVGSVGElement => {
  const d = open ? 'M9 2 C 1 10, 1 24, 9 32' : 'M2 2 C 10 10, 10 24, 2 32';
  return s('svg', { class: 'hud-gap__br', viewBox: '0 0 11 34', 'aria-hidden': 'true' }, s('path', { class: 'hud-gap__case', d }), s('path', { class: 'hud-gap__stroke', d }));
};

class GapMarker {
  readonly el: HTMLElement;
  private num = h('span.hud-gap__num', '0');
  private x = -1e4;
  private y = -1e4;
  private value = -1;
  private band = '';
  private visible = false;

  constructor(side: 'left' | 'right') {
    this.el = h(
      'div.hud-gap.is-off',
      { data: { side } },
      h('div.hud-gap__inner', bracket(true), h('span.hud-gap__val', this.num, h('span.hud-gap__unit', 'cm')), bracket(false)),
    );
  }

  set(cm: number | null, at: ScreenPoint | null): void {
    const on = cm !== null && at !== null;
    if (on !== this.visible) {
      this.visible = on;
      this.el.classList.toggle('is-off', !on);
    }
    if (!on || cm === null || at === null) return;
    if (Math.abs(at.x - this.x) > 0.5 || Math.abs(at.y - this.y) > 0.5) {
      this.x = at.x;
      this.y = at.y;
      this.el.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
    }
    const v = Math.max(0, Math.round(cm));
    if (v !== this.value) {
      this.value = v;
      this.num.textContent = String(v);
    }
    const band = gapBand(cm);
    if (band !== this.band) {
      this.band = band;
      this.el.classList.toggle('is-tight', band === 'tight');
      this.el.classList.toggle('is-critical', band === 'critical');
    }
  }
}

export class ClearanceBrackets implements HudWidget {
  readonly el: HTMLElement;
  private left = new GapMarker('left');
  private right = new GapMarker('right');

  constructor() {
    this.el = h('div.hud-gaps', { style: { display: 'contents' } }, this.left.el, this.right.el);
  }

  update(st: HudState): void {
    const c = st.clearance;
    this.left.set(c.leftCm, c.leftScreen);
    this.right.set(c.rightCm, c.rightScreen);
  }

  /** best guess for the rider's screen position (popup origin) */
  static anchor(st: HudState): ScreenPoint | null {
    if (st.bikeScreen) return st.bikeScreen;
    const { leftScreen: l, rightScreen: r } = st.clearance;
    if (l && r) return { x: (l.x + r.x) / 2, y: Math.min(l.y, r.y) };
    return l ?? r ?? null;
  }
}
