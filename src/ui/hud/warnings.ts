/**
 * Top-centre rule warnings: counterflow (coral, −15/s), centre-line riding against traffic (amber, tolerated — no
 * penalty) and sidewalk riding (amber, −20/s), with curb-stripe edges.
 */
import type { HudState } from '../../core/types/hud';
import type { HudWidget } from './types';
import { h } from '../core/h';
import { icon } from '../icons/icon';
import { pop } from '../core/animate';
import { SCORE } from '../../core/config/scoring';

export class Warnings implements HudWidget {
  readonly el: HTMLElement;
  private counter = h('div.hud-warn.is-off', icon('wrongway', 18), '역주행 중', h('small', `−${SCORE.counterflowPerSec}/s`));
  private line = h('div.hud-warn.hud-warn--amber.is-off', icon('wrongway', 18), '중앙선 주행', h('small', '감점 없음'));
  private walk = h('div.hud-warn.hud-warn--amber.is-off', icon('walk', 18), '인도 주행', h('small', `−${SCORE.sidewalkPerSec}/s`));
  private cf = false;
  private cl = false;
  private sw = false;

  constructor() {
    this.el = h('div.hud-warns', { role: 'status' }, this.counter, this.line, this.walk);
  }

  update(s: HudState): void {
    if (s.counterflow !== this.cf) {
      this.cf = s.counterflow;
      this.counter.classList.toggle('is-off', !this.cf);
      if (this.cf) pop(this.counter, { from: 0.6 });
    }
    const cl = s.centerline === true;
    if (cl !== this.cl) {
      this.cl = cl;
      this.line.classList.toggle('is-off', !cl);
      if (cl) pop(this.line, { from: 0.6 });
    }
    if (s.onSidewalk !== this.sw) {
      this.sw = s.onSidewalk;
      this.walk.classList.toggle('is-off', !this.sw);
      if (this.sw) pop(this.walk, { from: 0.6 });
    }
  }
}
