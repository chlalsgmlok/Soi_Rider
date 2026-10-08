/**
 * In-ride HUD (mockups 02/03): corners + floating layer. Call update(state) every frame — every widget diffs
 * against its own cache and only touches textContent / transforms / classes when something visibly changed.
 *
 *   ui.hud.configure({ topSpeedKmh: 70, timeOfDay: 'sunset', minimap: true });
 *   ui.hud.setMapSource(mapSourceFromCity(city.data));
 *   const unbind = ui.hud.bind(bus);  ui.show('hud', {}, 'wipe');   …   ui.hud.update(state)
 */
import type { HudState, PromptId, PromptState } from '../../core/types/hud';
import type { ScreenPoint } from '../../core/types/geometry';
import type { MissionPhase } from '../../core/types/game';
import type { EventBus, Mood, Tone } from '../../core/events';
import type { HudConfig, HudDeps, HudWidget, MapSource, PopupKind } from './types';
import { h } from '../core/h';
import { TripTag } from './trip-tag';
import { TargetReadout } from './target-readout';
import { SpeedGauge } from './speed-gauge';
import { RiderStatus } from './rider-status';
import { MiniPhone } from './mini-phone';
import { SpeechBubble } from './speech';
import { ClearanceBrackets } from './clearance';
import { ComboPopups } from './popups';
import { Callout, type CalloutSpec } from './callout';
import { PromptBanner } from './prompt-banner';
import { Warnings } from './warnings';
import { EdgeFlash } from './flash';
import { bindHudToBus } from './hud-bus';

export class Hud {
  readonly el: HTMLElement;
  private trip = new TripTag();
  private target = new TargetReadout();
  private gauge = new SpeedGauge();
  private status = new RiderStatus();
  private phone = new MiniPhone();
  private speech = new SpeechBubble();
  private gaps = new ClearanceBrackets();
  private pops = new ComboPopups();
  private callout = new Callout();
  private banner = new PromptBanner();
  private warns = new Warnings();
  private edge = new EdgeFlash();
  private widgets: HudWidget[];
  private last: HudState | null = null;
  private shown = false;
  private tc: HTMLElement;
  private tcObserver: ResizeObserver;
  private metrics: HTMLElement;

  constructor(layer: HTMLElement, private deps: HudDeps) {
    this.phone.el.append(this.speech.el);
    this.tc = h('div.hud__corner.hud__tc', this.banner.el, this.warns.el);
    this.metrics = layer.closest<HTMLElement>('.ui-root') ?? document.documentElement;
    this.tcObserver = new ResizeObserver(() => this.publishMetrics());
    this.el = h(
      'div.hud',
      { aria: { label: '주행 정보' } },
      this.edge.el,
      h('div.hud-float', this.gaps.el, this.pops.el, this.callout.el),
      h('div.hud__corner.hud__tl', this.trip.el),
      h('div.hud__corner.hud__tr', this.target.el),
      this.tc,
      h('div.hud__corner.hud__bl', this.phone.el),
      h('div.hud__corner.hud__br', this.status.el, this.gauge.el),
    );
    this.widgets = [this.trip, this.target, this.gauge, this.status, this.phone, this.gaps, this.banner, this.warns];
    layer.append(this.el);
    this.tcObserver.observe(this.tc);
  }

  get visible(): boolean {
    return this.shown;
  }

  /** last HudState pushed by the game (null before the first update / after reset); the Pause screen reads the trip from it */
  get snapshot(): HudState | null {
    return this.last;
  }

  show(): void {
    if (this.shown) return;
    this.shown = true;
    this.el.classList.add('is-visible');
    this.publishMetrics();
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.el.classList.remove('is-visible');
    this.publishMetrics();
    this.speech.hide();
  }

  configure(cfg: Partial<HudConfig>): void {
    if (cfg.topSpeedKmh !== undefined) this.gauge.setMax(cfg.topSpeedKmh);
    if (cfg.timeOfDay !== undefined) {
      this.trip.setTimeOfDay(cfg.timeOfDay);
      this.phone.setNight(cfg.timeOfDay === 'night');
      this.el.classList.toggle('is-night', cfg.timeOfDay === 'night');
    }
    if (cfg.minimap !== undefined) this.phone.setMinimapVisible(cfg.minimap);
  }

  setMapSource(fn: MapSource | null): void {
    this.phone.setMapSource(fn);
  }

  /** per-frame snapshot (cheap; diffed + throttled inside each widget) */
  update(state: HudState): void {
    this.last = state;
    if (!this.shown) return;
    const now = performance.now();
    for (const w of this.widgets) w.update(state, now);
  }

  popup(kind: PopupKind, text: string, at?: ScreenPoint): void {
    if (!this.shown) return;
    const anchor = at ?? (this.last ? ClearanceBrackets.anchor(this.last) : null) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.62 };
    this.pops.spawn(kind, text, anchor);
  }

  say(text: string, mood: Mood = 'neutral'): void {
    this.speech.say(text, mood);
  }

  prompt(p: PromptState): void {
    this.banner.open(p);
    this.deps.sfx('ping');
  }

  resolvePrompt(id: PromptId, success: boolean): void {
    this.banner.resolve(id, success);
  }

  /** centre callout for a mission phase change (no-op for phases without one) */
  phase(p: MissionPhase): void {
    if (this.shown && this.callout.phase(p)) this.deps.sfx('swoosh');
  }

  announce(spec: CalloutSpec): void {
    this.callout.show(spec);
    this.deps.sfx('swoosh');
  }

  flash(tone: Tone, strength = 1): void {
    if (this.shown) this.edge.flash(tone, strength);
  }

  toast(text: string, tone: Tone = 'info', icon?: string): void {
    this.deps.toast(text, tone, icon);
  }

  bind(bus: EventBus): () => void {
    return bindHudToBus(this, bus);
  }

  /** clear transient effects between runs */
  reset(): void {
    this.pops.clear();
    this.callout.clear();
    this.banner.clear();
    void this.speech.hide();
    this.last = null;
  }

  /** --hud-tc-h on the UI root: the toast stack sits below the prompt banner + warnings while riding */
  private publishMetrics(): void {
    const px = this.shown ? Math.ceil(this.tc.getBoundingClientRect().height) : 0;
    this.metrics.style.setProperty('--hud-tc-h', `${px}px`);
  }

  dispose(): void {
    this.tcObserver.disconnect();
    this.metrics.style.removeProperty('--hud-tc-h');
    this.reset();
    this.phone.dispose();
    this.el.remove();
  }
}
