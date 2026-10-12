/**
 * Screen router: one base screen + a stack of overlays. All swaps are serialised through one queue so
 * transitions never overlap. show() mounts immediately (hidden) and returns a live handle; the swap happens
 * while the transition covers the screen.
 */
import type { SaveData } from '../../core/types/save';
import type { ScreenId, ScreenPropsMap, Transition } from '../../core/types/screens';
import type { ScreenContext, ScreenHandle, ScreenView, ShowOptions, UiServices, EnterStyle } from './screen-types';
import { getScreen, isDefaultOverlay } from './screen-registry';
import type { Transitions } from './transition';
import type { FocusNav } from './focus-nav';
import { h } from './h';
import { popOut, settled } from './animate';

interface Entry<K extends ScreenId = ScreenId> {
  id: K;
  el: HTMLElement;
  props: ScreenPropsMap[K];
  view: ScreenView<K>;
  overlay: boolean;
  enter: EnterStyle;
  disposers: Array<() => void>;
  state: 'pending' | 'active' | 'closed';
  restoreFocus: Element | null;
}

export class Router {
  private base: Entry | null = null;
  private overlays: Entry[] = [];
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private layer: HTMLElement,
    private transitions: Transitions,
    private services: UiServices,
    private nav: () => FocusNav,
  ) {}

  top(): Entry | null {
    return this.overlays[this.overlays.length - 1] ?? this.base;
  }

  /** ids of the visible stack, bottom → top */
  stack(): ScreenId[] {
    return [this.base, ...this.overlays].filter((e): e is Entry => !!e).map((e) => e.id);
  }

  show<K extends ScreenId>(id: K, props: ScreenPropsMap[K], transition: Transition, opts: ShowOptions = {}): ScreenHandle<K> {
    const reg = getScreen(id);
    const overlay = opts.overlay ?? reg?.opts.overlay ?? isDefaultOverlay(id);
    const el = h('section.screen', {
      class: [`screen--${id}`, overlay && 'screen--overlay', reg?.opts.passthrough && 'screen--passthrough'],
      data: { screen: id, phase: 'pending' },
      tabindex: -1,
    });
    const entry: Entry<K> = {
      id,
      el,
      props,
      view: {},
      overlay,
      enter: reg?.opts.enter ?? (overlay ? 'pop' : 'rise'),
      disposers: [],
      state: 'pending',
      restoreFocus: null,
    };
    this.layer.append(el);
    const ctx: ScreenContext<K> = {
      id,
      el,
      ui: this.services,
      props: () => entry.props,
      close: (t) => this.close(entry, t),
      onDispose: (fn) => entry.disposers.push(fn),
      focusFirst: () => this.nav().focusFirst(el),
    };
    if (reg) {
      try {
        entry.view = reg.mount(ctx) ?? {};
      } catch (err) {
        console.error(`[ui] screen "${id}" failed to mount`, err);
      }
    } else console.warn(`[ui] no screen registered for "${id}" — showing an empty layer`);
    this.enqueue(() => this.swapIn(entry, transition, opts.onCovered));
    return this.handle(entry);
  }

  /** push a fresh save into every live screen whose props carry one (free fuel refill while a menu is open) */
  patchSave(save: SaveData): void {
    for (const e of [this.base, ...this.overlays]) if (e && e.state !== 'closed' && 'save' in e.props) this.handle(e).update({ save });
  }

  /** run a transition without a screen change, serialised with screen swaps */
  transition(kind: Transition, onCovered?: () => void): Promise<void> {
    return this.enqueue(() => this.transitions.run(kind, onCovered));
  }

  closeAll(): void {
    for (const e of [...this.overlays, this.base]) if (e) this.destroy(e);
    this.overlays = [];
    this.base = null;
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    const run = this.queue.then(job).catch((err: unknown) => console.error('[ui] router job failed', err));
    this.queue = run;
    return run;
  }

  private handle<K extends ScreenId>(entry: Entry<K>): ScreenHandle<K> {
    return {
      id: entry.id,
      el: entry.el,
      get closed() {
        return entry.state === 'closed';
      },
      props: () => entry.props,
      update: (partial) => {
        if (entry.state === 'closed') return;
        entry.props = { ...entry.props, ...partial };
        try {
          entry.view.update?.(entry.props, partial);
        } catch (err) {
          console.error(`[ui] screen "${entry.id}" update failed`, err);
        }
      },
      close: (t) => this.close(entry, t),
    };
  }

  private async swapIn(entry: Entry, transition: Transition, onCovered?: () => void): Promise<void> {
    if (entry.state === 'closed') return;
    await this.transitions.run(entry.overlay && transition === 'wipe' ? 'none' : transition, () => {
      if (entry.overlay) {
        entry.restoreFocus = document.activeElement;
        this.overlays.push(entry);
      } else {
        for (const o of this.overlays) this.destroy(o);
        this.overlays = [];
        if (this.base) this.destroy(this.base);
        this.base = entry;
      }
      onCovered?.();
      this.reveal(entry);
    });
  }

  private reveal(entry: Entry): void {
    entry.state = 'active';
    entry.el.dataset.phase = 'active';
    if (entry.enter !== 'none') entry.el.dataset.enter = entry.enter;
    try {
      entry.view.enter?.();
    } catch (err) {
      console.error(`[ui] screen "${entry.id}" enter failed`, err);
    }
    if (!entry.el.contains(document.activeElement)) this.nav().focusFirst(entry.el);
  }

  private close(entry: Entry, transition?: Transition): Promise<void> {
    if (entry.state === 'closed') return Promise.resolve();
    if (entry.state === 'pending') {
      this.destroy(entry);
      return Promise.resolve();
    }
    const t = transition ?? (entry.overlay ? 'none' : 'fade');
    return this.enqueue(async () => {
      if (entry.state === 'closed') return;
      entry.el.dataset.phase = 'leaving';
      if (t === 'none') {
        const leaving = entry.view.leave?.();
        await (leaving ?? settled(popOut(entry.el, { to: 0.97 })));
        this.detach(entry);
      } else await this.transitions.run(t, () => this.detach(entry));
    });
  }

  private detach(entry: Entry): void {
    const restore = entry.restoreFocus;
    this.destroy(entry);
    this.overlays = this.overlays.filter((e) => e !== entry);
    if (this.base === entry) this.base = null;
    const top = this.top();
    if (!top) return;
    if (restore instanceof HTMLElement && top.el.contains(restore)) restore.focus({ preventScroll: true });
    else this.nav().focusFirst(top.el);
  }

  private destroy(entry: Entry): void {
    if (entry.state === 'closed') return;
    entry.state = 'closed';
    try {
      entry.view.destroy?.();
    } catch (err) {
      console.error(`[ui] screen "${entry.id}" destroy failed`, err);
    }
    for (const fn of entry.disposers.splice(0)) fn();
    entry.el.remove();
  }
}
