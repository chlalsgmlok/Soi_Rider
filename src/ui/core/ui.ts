/**
 * UI facade — the only object src/app needs.
 *   const ui = new UI(document.getElementById('ui')!);
 *   const boot = ui.show('boot', { progress: 0, label: '' }, 'none');  boot.update({ progress: .5 });
 *   ui.show('title', titleProps, 'wipe', { onCovered: () => engine.setScene(titleScene) });
 *   ui.hud.update(state)  ·  ui.toast('연료 +5', 'good')  ·  ui.nav.press('down')  (gamepad)
 */
import '../styles/load-styles';
import type { SaveData } from '../../core/types/save';
import type { ScreenId, ScreenPropsMap, Transition } from '../../core/types/screens';
import { bus as globalBus, type EventBus, type Tone, type UiSfx } from '../../core/events';
import type { ScreenHandle, ShowOptions, UiServices } from './screen-types';
import { h } from './h';
import { Transitions } from './transition';
import { FocusNav } from './focus-nav';
import { Router } from './router';
import { Toaster } from './toaster';
import { watchViewportScale } from './viewport-scale';
import { delegateSfx } from './sfx-delegate';
import { setReducedMotion } from './motion';
import { hasScreen, registerScreen } from './screen-registry';
import { Hud } from '../hud/hud';
import { openSheet, type SheetHandle, type SheetOptions } from '../components/sheet';

export interface UIOptions {
  /** event bus for ui:sfx (default: the app-wide `bus`) */
  bus?: EventBus;
}

export class UI implements UiServices {
  readonly root: HTMLElement;
  readonly hud: Hud;
  readonly nav: FocusNav;
  private router: Router;
  private toaster: Toaster;
  private screensLayer: HTMLElement;
  private bus: EventBus;
  private cleanups: Array<() => void> = [];

  constructor(root: HTMLElement, opts: UIOptions = {}) {
    this.root = root;
    this.bus = opts.bus ?? globalBus;
    root.classList.add('ui-root');
    const hudLayer = h('div.ui-layer.ui-layer--hud');
    this.screensLayer = h('div.ui-layer.ui-layer--screens');
    const toastLayer = h('div.ui-layer.ui-layer--toasts');
    const wipeLayer = h('div.ui-layer.ui-layer--wipe');
    root.append(hudLayer, this.screensLayer, toastLayer, wipeLayer);

    this.toaster = new Toaster(toastLayer);
    this.hud = new Hud(hudLayer, { toast: (t, tone, icon) => this.toast(t, tone, icon), sfx: (n) => this.sfx(n) });
    this.nav = new FocusNav({
      scope: () => this.router.top()?.el ?? null,
      key: (e) => this.router.top()?.view.key?.(e) ?? false,
      back: () => this.router.top()?.view.back?.() ?? false,
      sfx: (n) => this.sfx(n),
    });
    this.router = new Router(this.screensLayer, new Transitions(wipeLayer), this, () => this.nav);
    this.cleanups.push(watchViewportScale(), delegateSfx(this.screensLayer, (n) => this.sfx(n)), () => this.nav.dispose());

    if (!hasScreen('hud')) {
      registerScreen(
        'hud',
        (ctx) => {
          ctx.el.inert = true; // HUD lives in its own layer; the empty screen must never take focus
          return { enter: () => this.hud.show(), destroy: () => this.hud.hide() };
        },
        { passthrough: true, enter: 'none' },
      );
    }
  }

  show<K extends ScreenId>(id: K, props: ScreenPropsMap[K], transition: Transition = 'wipe', opts?: ShowOptions): ScreenHandle<K> {
    return this.router.show(id, props, transition, opts);
  }

  transition(kind: Transition, onCovered?: () => void): Promise<void> {
    return this.router.transition(kind, onCovered);
  }

  /** visible screen ids, bottom → top */
  stack(): ScreenId[] {
    return this.router.stack();
  }

  top(): ScreenId | null {
    return this.router.top()?.id ?? null;
  }

  /** the save changed outside a screen's own callbacks (free fuel refill): update every open screen that shows one */
  refreshSave(save: SaveData): void {
    this.router.patchSave(save);
  }

  toast(text: string, tone: Tone = 'info', icon?: string): void {
    this.toaster.show(text, tone, icon);
  }

  sfx(name: UiSfx): void {
    this.bus.emit('ui:sfx', { name });
  }

  sheet(opts: SheetOptions): SheetHandle {
    return openSheet(this.router.top()?.el ?? this.screensLayer, opts);
  }

  /** Settings.reducedMotion → true/false; null follows the OS preference */
  setReducedMotion(value: boolean | null): void {
    setReducedMotion(value);
  }

  closeAll(): void {
    this.router.closeAll();
  }

  dispose(): void {
    this.router.closeAll();
    this.hud.dispose();
    for (const fn of this.cleanups.splice(0)) fn();
    this.root.replaceChildren();
  }
}
