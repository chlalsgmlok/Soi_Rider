/** Top-right: phase label, coral pin + distance to target, ETA chip (amber < 30 s, coral when late). */
import type { HudState } from '../../core/types/hud';
import type { HudWidget } from './types';
import { h } from '../core/h';
import { icon } from '../icons/icon';
import { bump } from '../core/animate';
import { etaState, fmtClock, fmtDistance } from './format';
import { TARGET_LABEL } from './labels';

export class TargetReadout implements HudWidget {
  readonly el: HTMLElement;
  private label = h('div.hud-target__label');
  private num = h('span.hud-target__num', '0');
  private unit = h('span.hud-target__unit', 'm');
  private etaText = h('span.chip__text.t-num', '00:00');
  private eta = h('span.chip.chip--num.hud-eta', icon('clock', 15), this.etaText);
  private cache = { label: '', num: '', unit: '', eta: '', etaState: '', phase: '' };

  constructor() {
    this.el = h('div.hud-target', { style: { display: 'contents' } }, this.label, h('div.hud-target__dist', icon('pin', 30, { class: 'hud-target__pin' }), this.num, this.unit), this.eta);
  }

  update(s: HudState): void {
    const c = this.cache;
    const label = TARGET_LABEL[s.phase];
    if (label !== c.label) this.label.textContent = c.label = label;
    const d = fmtDistance(s.targetMeters);
    if (d.num !== c.num) this.num.textContent = c.num = d.num;
    if (d.unit !== c.unit) this.unit.textContent = c.unit = d.unit;
    if (s.phase !== c.phase) {
      const was = c.phase;
      c.phase = s.phase;
      const live = s.phase === 'toPickup' || s.phase === 'toDropoff' || s.phase === 'arriving';
      this.el.parentElement?.style.setProperty('opacity', live || s.phase === 'boarding' ? '1' : '.55');
      if (was) bump(this.num.parentElement as HTMLElement, 0.14);
    }
    const st = etaState(s.etaLeftSec);
    const text = st === 'late' ? `+${fmtClock(s.etaLeftSec)} 지연` : fmtClock(s.etaLeftSec);
    if (text !== c.eta) this.etaText.textContent = c.eta = text;
    if (st !== c.etaState) {
      c.etaState = st;
      this.eta.classList.toggle('is-warn', st === 'warn');
      this.eta.classList.toggle('is-late', st === 'late');
      if (st !== 'ok') bump(this.eta, 0.18);
    }
  }
}
