/**
 * Keyboard / gamepad menu navigation for the top-most screen.
 *  - Arrows: spatial focus move between focusables (buttons, inputs, [tabindex], [data-nav]); opt out with data-nav="skip".
 *  - Enter: activates non-native focusables ([data-nav] divs/cards). Native buttons handle Enter/Space themselves.
 *  - Esc / Backspace: dismisses an open sheet, else asks the screen's back() hook.
 * The app forwards gamepad input through press('up' | … | 'ok' | 'back').
 */
import type { UiSfx } from '../../core/events';
import { reducedMotion } from './motion';

export type NavDir = 'up' | 'down' | 'left' | 'right';
export type NavPress = NavDir | 'ok' | 'back';

export interface NavHooks {
  /** element that currently owns input (top-most screen) or null */
  scope(): HTMLElement | null;
  key(e: KeyboardEvent): boolean;
  back(): boolean;
  sfx(name: UiSfx): void;
}

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-nav]';
const KEY_DIR: Record<string, NavDir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

const isTextField = (el: Element | null): boolean =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(el.type));

export class FocusNav {
  constructor(private hooks: NavHooks) {
    window.addEventListener('keydown', this.onKey);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  /** effective scope: an open sheet inside the screen captures navigation */
  private area(): HTMLElement | null {
    const scope = this.hooks.scope();
    if (!scope) return null;
    const sheets = scope.querySelectorAll<HTMLElement>('.sheet-scrim');
    return sheets.length ? sheets[sheets.length - 1] : scope;
  }

  focusables(area = this.area()): HTMLElement[] {
    if (!area) return [];
    return Array.from(area.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.dataset.nav !== 'skip' && !el.closest('[inert],[hidden],[data-phase="pending"]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
    );
  }

  focus(el: HTMLElement): void {
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  focusFirst(area = this.area()): void {
    if (!area) return;
    const list = this.focusables(area);
    const pick = list.find((el) => el.hasAttribute('data-autofocus')) ?? list.find((el) => el.classList.contains('is-selected') || el.classList.contains('is-active')) ?? list[0];
    if (pick) pick.focus({ preventScroll: true });
    else if (area.tabIndex >= -1) area.focus({ preventScroll: true });
  }

  move(dir: NavDir): boolean {
    const list = this.focusables();
    if (!list.length) return false;
    const cur = document.activeElement instanceof HTMLElement && list.includes(document.activeElement) ? document.activeElement : null;
    if (!cur) {
      this.focusFirst();
      return true;
    }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const q = el.getBoundingClientRect();
      const qx = q.left + q.width / 2;
      const qy = q.top + q.height / 2;
      const horizontal = dir === 'left' || dir === 'right';
      const main = dir === 'right' ? qx - cx : dir === 'left' ? cx - qx : dir === 'down' ? qy - cy : cy - qy;
      if (main <= 2) continue;
      const gap = horizontal ? Math.max(0, q.top - r.bottom, r.top - q.bottom) : Math.max(0, q.left - r.right, r.left - q.right);
      const off = horizontal ? Math.abs(qy - cy) : Math.abs(qx - cx);
      const score = main + gap * 3 + off * 0.35;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (!best) return false;
    this.focus(best);
    return true;
  }

  activate(): boolean {
    const el = document.activeElement;
    const area = this.area();
    if (!(el instanceof HTMLElement) || !area?.contains(el)) return false;
    el.click();
    return true;
  }

  back(): boolean {
    const area = this.area();
    if (area?.classList.contains('sheet-scrim')) {
      area.dispatchEvent(new CustomEvent('ui:dismiss'));
      return true;
    }
    return this.hooks.back();
  }

  /** gamepad / external input */
  press(p: NavPress): boolean {
    if (p === 'ok') return this.activate();
    if (p === 'back') {
      const ok = this.back();
      if (ok) this.hooks.sfx('back');
      return ok;
    }
    const moved = this.move(p);
    if (moved) this.hooks.sfx('hover');
    return moved;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.isComposing || !this.hooks.scope()) return;
    if (this.hooks.key(e)) {
      e.preventDefault();
      return;
    }
    const target = document.activeElement;
    const dir = KEY_DIR[e.key];
    if (dir) {
      if (isTextField(target) && (dir === 'left' || dir === 'right')) return;
      if (target instanceof HTMLInputElement && target.type === 'range' && (dir === 'left' || dir === 'right')) return;
      if (this.move(dir)) {
        e.preventDefault();
        this.hooks.sfx('hover');
      }
      return;
    }
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      const native = target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement || target instanceof HTMLInputElement;
      if (!native && target instanceof HTMLElement && target.matches('[data-nav],[tabindex]') && this.activate()) e.preventDefault();
      return;
    }
    if (e.key === 'Escape' || (e.key === 'Backspace' && !isTextField(target))) {
      if (this.back()) {
        e.preventDefault();
        this.hooks.sfx('back');
      }
    }
  };
}
