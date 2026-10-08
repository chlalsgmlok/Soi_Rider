/**
 * Contracts between the UI router and screen modules (src/ui/screens/*, built by the screen agents).
 *
 *   registerScreen('title', (ctx) => {
 *     ctx.el.append(h('div.title', …));
 *     return { enter() {…}, update(props) {…}, back() { return false; }, destroy() {…} };
 *   });
 *
 * Screen prop shapes come from src/core/types/screens.ts (ScreenPropsMap).
 */
import type { ScreenId, ScreenPropsMap, Transition } from '../../core/types/screens';
import type { Tone, UiSfx } from '../../core/events';
import type { Hud } from '../hud/hud';
import type { SheetHandle, SheetOptions } from '../components/sheet';

export type { ScreenId, ScreenPropsMap, Transition };

/** Services every screen can use (also exposed on the UI facade). */
export interface UiServices {
  readonly hud: Hud;
  toast(text: string, tone?: Tone, icon?: string): void;
  sfx(name: UiSfx): void;
  /** full-screen transition without changing screens (e.g. to swap the 3D backdrop) */
  transition(kind: Transition, onCovered?: () => void): Promise<void>;
  /** modal bottom sheet inside the top-most screen */
  sheet(opts: SheetOptions): SheetHandle;
}

export interface ScreenContext<K extends ScreenId> {
  readonly id: K;
  /** the screen root (`section.screen.screen--<id>`); mount your DOM here */
  readonly el: HTMLElement;
  readonly ui: UiServices;
  /** current (merged) props */
  props(): ScreenPropsMap[K];
  /** close this screen (default: 'fade' for base screens, 'none' + leave() for overlays) */
  close(transition?: Transition): Promise<void>;
  /** register cleanup to run on destroy (listeners, timers, count-ups) */
  onDispose(fn: () => void): void;
  /** focus [data-autofocus] or the first focusable element */
  focusFirst(): void;
}

/** Optional lifecycle hooks returned by a screen mount. */
export interface ScreenView<K extends ScreenId> {
  /** handle.update(partial) → merged props + the partial that changed */
  update?(props: ScreenPropsMap[K], changed: Partial<ScreenPropsMap[K]>): void;
  /** entrance choreography, called when the screen is revealed (after the wipe covers) */
  enter?(): void;
  /** exit animation; the router awaits it before removing the element (overlays / 'none' closes) */
  leave?(): Promise<void> | void;
  /** Esc / Backspace / gamepad B. Return true if handled. */
  back?(): boolean;
  /** raw keydown before focus navigation; return true to consume the key */
  key?(e: KeyboardEvent): boolean;
  destroy?(): void;
}

export type ScreenMount<K extends ScreenId> = (ctx: ScreenContext<K>) => ScreenView<K> | void;

export type EnterStyle = 'rise' | 'pop' | 'fade' | 'none';

export interface ScreenOptions {
  /** overlay screens stack above the base screen instead of replacing it (default: pause, settings) */
  overlay?: boolean;
  /** CSS entrance applied on reveal (default: base 'rise', overlay 'pop') */
  enter?: EnterStyle;
  /** let pointer events fall through to the canvas except on interactive children (garage turntable) */
  passthrough?: boolean;
}

export interface ShowOptions {
  /** force overlay/base behaviour for this call */
  overlay?: boolean;
  /** runs while the transition fully covers the screen — swap the 3D scene / camera here */
  onCovered?: () => void;
}

export interface ScreenHandle<K extends ScreenId = ScreenId> {
  readonly id: K;
  readonly el: HTMLElement;
  readonly closed: boolean;
  props(): ScreenPropsMap[K];
  update(partial: Partial<ScreenPropsMap[K]>): void;
  close(transition?: Transition): Promise<void>;
}
