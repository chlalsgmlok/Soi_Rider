/**
 * Modal bottom sheet (confirmations, purchase prompts, "out of fuel").
 *   const s = ui.sheet({ title: '구매할까요?', body: '고양이 귀 헬멧 · 450฿', icon: 'helmet',
 *     actions: [{ id: 'no', label: '취소', variant: 'ghost' }, { id: 'yes', label: '구매', variant: 'primary', sfx: 'buy' }] });
 *   const choice = await s.result;   // 'yes' | 'no' | null (dismissed)
 * Esc / Backspace / scrim click dismiss when `dismissible` (default true). Focus is trapped by FocusNav scoping.
 */
import { h, type Child } from '../core/h';
import { icon, type IconName } from '../icons/icon';
import { button, type ButtonVariant } from './button';
import { curbDivider } from './street';
import { popOut, settled, slideIn } from '../core/animate';
import type { UiSfx } from '../../core/events';

export interface SheetAction {
  id: string;
  label: string;
  variant?: ButtonVariant;
  icon?: IconName;
  sfx?: UiSfx | 'none';
  autofocus?: boolean;
  disabled?: boolean;
}

export interface SheetOptions {
  title: string;
  body?: Child;
  icon?: IconName;
  actions?: SheetAction[];
  dismissible?: boolean;
  /** centred card instead of bottom sheet */
  center?: boolean;
}

export interface SheetHandle {
  el: HTMLElement;
  /** resolves with the chosen action id, or null when dismissed */
  result: Promise<string | null>;
  close(id?: string | null): Promise<void>;
}

export function openSheet(container: HTMLElement, o: SheetOptions): SheetHandle {
  let resolve: (v: string | null) => void = () => undefined;
  const result = new Promise<string | null>((r) => (resolve = r));
  let closing = false;
  const restoreFocus = document.activeElement;
  const actions = (o.actions ?? [{ id: 'ok', label: '확인', variant: 'primary' as const, autofocus: true }]).map((a) =>
    button({ label: a.label, variant: a.variant ?? 'primary', icon: a.icon, sfx: a.sfx, autofocus: a.autofocus, disabled: a.disabled, onClick: () => void close(a.id) }),
  );
  const dismissible = o.dismissible ?? true;
  const sheet = h(
    'div.sheet',
    { role: 'dialog', aria: { modal: true, label: o.title } },
    curbDivider('thin'),
    h('div.sheet__head', o.icon ? h('span.sheet__icon', icon(o.icon, 22)) : null, h('h2.sheet__title', o.title)),
    o.body !== undefined ? h('div.sheet__body', o.body) : null,
    h('div.sheet__actions', actions),
  );
  const el = h('div.sheet-scrim', { class: o.center && 'sheet-scrim--center' }, sheet);

  async function close(id: string | null = null): Promise<void> {
    if (closing) return;
    closing = true;
    resolve(id);
    await Promise.all([settled(popOut(sheet, { to: 0.96 })), settled(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }))]);
    el.remove();
    if (restoreFocus instanceof HTMLElement && restoreFocus.isConnected) restoreFocus.focus({ preventScroll: true });
  }

  el.addEventListener('pointerdown', (e) => {
    if (dismissible && e.target === el) void close(null);
  });
  el.addEventListener('ui:dismiss', () => {
    if (dismissible) void close(null);
  });
  container.append(el);
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
  slideIn(sheet, o.center ? 'top' : 'bottom', { distance: o.center ? 16 : 60 });
  const first = actions.find((b) => b.dataset.autofocus !== undefined) ?? actions[actions.length - 1];
  first?.focus({ preventScroll: true });
  return { el, result, close };
}
