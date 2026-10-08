/**
 * Keyboard helpers for the menu screens' key()/back() hooks.
 *   isTyping()          — a text field has focus (never steal Q/E/1/2/3 hotkeys from it)
 *   disarmWithin(root)  — Esc first cancels an armed inline purchase (confirm-buy) before leaving the screen
 */
export function isTyping(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button'].includes(el.type));
}

export function disarmWithin(root: HTMLElement): boolean {
  const cancel = root.querySelector<HTMLButtonElement>('.confirm-buy.is-armed .confirm-buy__armed .btn--ghost');
  if (!cancel) return false;
  cancel.click();
  return true;
}

/** plain hotkey (no modifiers, not typing) */
export function hotkey(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping()) return null;
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}
