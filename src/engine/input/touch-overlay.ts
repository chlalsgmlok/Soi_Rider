import type { SourceFrame } from './input-shaping';
import { TOUCH_CSS, TOUCH_ICONS } from './touch-styles';

type HoldKey = 'gas' | 'brake' | 'tuck';
type TapKey = 'horn' | 'act' | 'cam' | 'pause';
const LABELS: Record<HoldKey | TapKey, string> = {
  gas: '가속', brake: '브레이크', tuck: '움츠리기', horn: '경적', act: '건네기', cam: '카메라', pause: '',
};
/** px of horizontal drag for full steering lock */
export const TOUCH_STEER_RANGE = 72;

let styleInjected = false;

/**
 * On-screen controls: floating steering pad (left half — the pad re-centres under the thumb), throttle + brake
 * (hold), tuck (hold), horn / interact / camera / pause (tap). Multi-touch via pointer capture.
 */
export class TouchOverlay {
  readonly root: HTMLDivElement;
  lastUsed = 0;
  private readonly held = new Set<HoldKey>();
  private readonly taps = new Set<TapKey>();
  private readonly zone: HTMLDivElement;
  private readonly pad: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private steerId = -1;
  private steerX0 = 0;
  private steer = 0;
  private anyTap = false;

  constructor(parent: HTMLElement = document.body) {
    if (!styleInjected) {
      const style = document.createElement('style');
      style.dataset.soi = 'touch';
      style.textContent = TOUCH_CSS;
      document.head.appendChild(style);
      styleInjected = true;
    }
    this.root = document.createElement('div');
    this.root.className = 'soi-touch';
    this.root.hidden = true;
    this.zone = this.div('zone', this.root);
    this.pad = this.div('pad', this.zone);
    this.knob = this.div('knob', this.pad);
    for (const k of ['gas', 'brake', 'tuck'] as const) this.button(k, true);
    for (const k of ['horn', 'act', 'cam', 'pause'] as const) this.button(k, false);
    this.zone.addEventListener('pointerdown', this.steerDown);
    this.zone.addEventListener('pointermove', this.steerMove);
    this.zone.addEventListener('pointerup', this.steerUp);
    this.zone.addEventListener('pointercancel', this.steerUp);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    parent.appendChild(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  set visible(v: boolean) {
    if (v === this.visible) return;
    this.root.hidden = !v;
    if (v) this.placePad(null);
    else this.clear();
  }

  read(out: SourceFrame): void {
    out.steer = this.steer;
    out.throttle = this.held.has('gas') ? 1 : 0;
    out.brake = this.held.has('brake') ? 1 : 0;
    out.tuck = this.held.has('tuck');
    out.horn = this.taps.has('horn');
    out.interact = this.taps.has('act');
    out.camera = this.taps.has('cam');
    out.pause = this.taps.has('pause');
    out.any = this.anyTap;
    out.active = this.anyTap || this.held.size > 0 || this.steerId >= 0;
    this.taps.clear();
    this.anyTap = false;
  }

  clear(): void {
    this.held.clear();
    this.taps.clear();
    this.steerId = -1;
    this.steer = 0;
    this.knob.style.transform = '';
    for (const el of this.root.querySelectorAll('.down')) el.classList.remove('down');
  }

  dispose(): void {
    this.root.remove();
  }

  private div(cls: string, parent: HTMLElement): HTMLDivElement {
    const d = document.createElement('div');
    d.className = cls;
    parent.appendChild(d);
    return d;
  }

  private button(key: HoldKey | TapKey, hold: boolean): void {
    const b = this.div(`btn ${key}`, this.root);
    b.innerHTML = TOUCH_ICONS[key] + (LABELS[key] ? `<span>${LABELS[key]}</span>` : '');
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', LABELS[key] || '일시정지');
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.classList.add('down');
      this.mark();
      if (hold) this.held.add(key as HoldKey);
      else this.taps.add(key as TapKey);
    });
    const up = (): void => {
      b.classList.remove('down');
      if (hold) this.held.delete(key as HoldKey);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  }

  private mark(): void {
    this.anyTap = true;
    this.lastUsed = performance.now();
  }

  private placePad(e: PointerEvent | null): void {
    const r = this.zone.getBoundingClientRect();
    const x = e ? e.clientX - r.left : Math.max(120, r.width * 0.32);
    const y = e ? e.clientY - r.top : Math.max(60, r.height - 92);
    this.pad.style.left = `${Math.min(Math.max(x, 110), Math.max(110, r.width - 110))}px`;
    this.pad.style.top = `${Math.min(Math.max(y, 40), Math.max(40, r.height - 40))}px`;
  }

  private readonly steerDown = (e: PointerEvent): void => {
    if (this.steerId >= 0) return;
    e.preventDefault();
    this.zone.setPointerCapture(e.pointerId);
    this.steerId = e.pointerId;
    this.steerX0 = e.clientX;
    this.placePad(e);
    this.pad.classList.add('on');
    this.mark();
  };

  private readonly steerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.steerId) return;
    const dx = Math.max(-TOUCH_STEER_RANGE, Math.min(TOUCH_STEER_RANGE, e.clientX - this.steerX0));
    this.steer = dx / TOUCH_STEER_RANGE;
    this.knob.style.transform = `translateX(${dx}px)`;
    this.lastUsed = performance.now();
  };

  private readonly steerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.steerId) return;
    this.steerId = -1;
    this.steer = 0;
    this.knob.style.transform = '';
    this.pad.classList.remove('on');
    this.placePad(null);
  };
}
