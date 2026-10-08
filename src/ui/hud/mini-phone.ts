/**
 * Bottom-left gram mini-phone: phase bar, passenger (avatar from PassengerLook, name, origin ★rating, trait chip),
 * comfort face + bar (coloured by value), heading-up mini-map. Rebuilds the passenger block only when the id changes.
 */
import type { HudState } from '../../core/types/hud';
import type { MissionPhase, PassengerProfile } from '../../core/types/game';
import type { HudWidget, MapSource } from './types';
import { h } from '../core/h';
import { icon } from '../icons/icon';
import { pop } from '../core/animate';
import { phoneFrame } from '../components/phone';
import { avatar } from '../components/avatar';
import { chip } from '../components/chip';
import { comfortFace } from '../components/face';
import { comfortTone, meter } from '../components/bars';
import { Minimap } from './minimap';
import { PHASE_TEXT, TRAIT } from './labels';

export class MiniPhone implements HudWidget {
  /** wrapper (position: relative) — the speech bubble mounts here, above the phone */
  readonly el: HTMLElement;
  private phaseText = h('span.hud-phone__phase-text', '');
  private phase = h('span.hud-phone__phase', h('span.hud-phone__phase-dot'), this.phaseText);
  private pax = h('div.hud-phone__pax');
  private waiting = h('div.hud-phone__waiting', h('span.chip__dot.is-live', { style: { '--tone': 'var(--c-cyan-deep)' } }), '콜 연결 중…');
  private face = comfortFace(80);
  private comfortMeter = meter({ value: 0.8, tone: 'good', label: '승차감' });
  private comfortVal = h('span.hud-phone__comfort-val', '80');
  private comfortRow = h('div.hud-phone__comfort', { title: '승차감' }, this.face.el, this.comfortMeter.el, this.comfortVal);
  private mapWrap: HTMLElement;
  private minimap = new Minimap();
  private paxId: string | null | undefined = undefined;
  private lastPhase: MissionPhase | null = null;
  private lastComfort = -1;

  constructor() {
    this.face.el.classList.add('hud-phone__face');
    this.mapWrap = h('div.hud-phone__map-wrap', this.minimap.canvas);
    const frame = phoneFrame(
      { mini: true, free: true, class: 'hud-phone' },
      h('div.hud-phone__bar', h('span.gram-logo.gram-logo--sm', 'gram'), this.phase),
      this.pax,
      this.waiting,
      this.comfortRow,
      this.mapWrap,
    );
    this.el = h('div.hud-phone-wrap', { style: { position: 'relative' } }, frame.el);
  }

  setMapSource(fn: MapSource | null): void {
    this.minimap.setSource(fn);
  }

  setNight(on: boolean): void {
    this.minimap.setNight(on);
  }

  setMinimapVisible(on: boolean): void {
    this.mapWrap.classList.toggle('is-off', !on);
  }

  dispose(): void {
    this.minimap.dispose();
  }

  update(s: HudState, now: number): void {
    const id = s.passenger?.id ?? null;
    if (id !== this.paxId) {
      this.paxId = id;
      this.renderPassenger(s.passenger);
    }
    if (s.phase !== this.lastPhase) {
      this.lastPhase = s.phase;
      this.phaseText.textContent = PHASE_TEXT[s.phase];
      this.phase.classList.toggle('is-dropoff', s.phase === 'toDropoff' || s.phase === 'arriving');
      pop(this.phase, { from: 0.9 });
    }
    const c = Math.round(s.comfort);
    if (c !== this.lastComfort) {
      this.lastComfort = c;
      this.comfortVal.textContent = String(c);
      this.comfortMeter.set(c / 100, comfortTone(c));
      this.comfortMeter.el.classList.toggle('is-critical', c < 20);
      if (this.face.update(c)) pop(this.face.el, { from: 1.35 });
    }
    if (!this.mapWrap.classList.contains('is-off')) this.minimap.update(s.minimap, s.speedKmh, now);
  }

  private renderPassenger(p: PassengerProfile | null): void {
    this.waiting.hidden = !!p;
    this.pax.hidden = !p;
    this.comfortRow.hidden = !p;
    if (!p) {
      this.pax.replaceChildren();
      return;
    }
    const t = TRAIT[p.trait];
    this.pax.replaceChildren(
      avatar(p.look, 'md'),
      h(
        'div.hud-phone__who',
        h('div.hud-phone__name', p.name),
        h('div.hud-phone__origin', icon('star', 11), h('span.hud-phone__rating', p.rating.toFixed(1)), h('span.hud-phone__sep', '·'), h('span.u-ellipsis', p.origin)),
      ),
      chip({ text: t.label, tone: t.tone, icon: t.icon, size: 'sm', class: 'hud-phone__trait', solid: true }),
    );
    pop(this.pax, { from: 0.92 });
  }
}
