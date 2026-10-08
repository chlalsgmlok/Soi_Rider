/**
 * Bottom-right speed arc: 250° cyan sweep (0 → gauge max), ticks every 10 km/h, big Kanit numeral + km/h,
 * inner nav arrow rotated to the target bearing (amber when the target is behind), amber cap tick while tucking.
 */
import type { HudState } from '../../core/types/hud';
import type { HudWidget } from './types';
import { h, s } from '../core/h';
import { icon } from '../icons/icon';
import { stableSpeed } from './format';

const CX = 94;
const CY = 92;
const R = 78;
const START = 145;
const SWEEP = 250;
const ARC_LEN = (R * SWEEP * Math.PI) / 180;
const TUCK_CAP_KMH = 15;

const pt = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

const arcPath = (): string => {
  const [x0, y0] = pt(START, R);
  const [x1, y1] = pt(START + SWEEP, R);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export class SpeedGauge implements HudWidget {
  readonly el: HTMLElement;
  private sweep = s('path', { class: 'hud-gauge__sweep', d: arcPath(), 'stroke-dasharray': `${ARC_LEN} ${ARC_LEN}` });
  private ticks = s('g', { class: 'hud-gauge__ticks' });
  private cap = s('line', { class: 'hud-gauge__cap' });
  private speed = h('span.hud-gauge__speed', '0');
  private arrow = h('div.hud-gauge__arrow', icon('nav', 38));
  private max = 80;
  private shown = 0;
  private lastFrac = -1;
  private lastBearing = 999;
  private tucking = false;

  constructor() {
    const svg = s('svg', { class: 'hud-gauge__svg', viewBox: '0 0 188 176', 'aria-hidden': 'true' }, s('path', { class: 'hud-gauge__case', d: arcPath() }), s('path', { class: 'hud-gauge__track', d: arcPath() }), this.ticks, this.sweep, this.cap);
    this.el = h(
      'div.hud-gauge',
      { role: 'img', aria: { label: '속도계' } },
      svg,
      this.arrow,
      h('div.hud-gauge__readout', this.speed, h('span.hud-gauge__unit', 'km/h')),
    );
    this.setMax(80);
    this.sweep.setAttribute('stroke-dashoffset', String(ARC_LEN));
  }

  /** full-scale from the bike's top speed, rounded up to 10 */
  setMax(topKmh: number): void {
    this.max = Math.max(40, Math.ceil(topKmh / 10) * 10);
    this.ticks.replaceChildren();
    for (let v = 0; v <= this.max; v += 10) {
      const deg = START + (SWEEP * v) / this.max;
      const major = v % 20 === 0;
      const [x0, y0] = pt(deg, R + 9);
      const [x1, y1] = pt(deg, R + (major ? 15 : 13));
      this.ticks.append(s('line', { x1: x0.toFixed(2), y1: y0.toFixed(2), x2: x1.toFixed(2), y2: y1.toFixed(2), class: major ? 'is-major' : undefined }));
    }
    const capDeg = START + (SWEEP * TUCK_CAP_KMH) / this.max;
    const [a0, b0] = pt(capDeg, R - 8);
    const [a1, b1] = pt(capDeg, R + 16);
    this.cap.setAttribute('x1', a0.toFixed(2));
    this.cap.setAttribute('y1', b0.toFixed(2));
    this.cap.setAttribute('x2', a1.toFixed(2));
    this.cap.setAttribute('y2', b1.toFixed(2));
    this.lastFrac = -1;
  }

  update(st: HudState): void {
    const raw = Math.abs(st.speedKmh);
    const frac = Math.min(1, raw / this.max);
    if (Math.abs(frac - this.lastFrac) > 0.0015) {
      this.lastFrac = frac;
      this.sweep.setAttribute('stroke-dashoffset', (ARC_LEN * (1 - frac)).toFixed(2));
    }
    const next = stableSpeed(raw, this.shown);
    if (next !== this.shown || this.speed.textContent === '') {
      this.shown = next;
      this.speed.textContent = String(next);
    }
    const deg = (st.targetBearing * 180) / Math.PI;
    if (Math.abs(deg - this.lastBearing) > 0.5) {
      this.lastBearing = deg;
      this.arrow.style.setProperty('--bearing', `${deg.toFixed(1)}deg`);
      this.arrow.classList.toggle('is-behind', Math.abs(deg) > 100);
    }
    if (st.tucking !== this.tucking) {
      this.tucking = st.tucking;
      this.el.classList.toggle('is-tucking', st.tucking);
    }
  }
}
