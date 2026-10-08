const GESTURES = ['pointerdown', 'keydown', 'touchend', 'mousedown'] as const;

/**
 * Browsers only let audio start inside a user gesture. Listens (capture phase, passive) for gestures on `target`
 * and calls `unlock` whenever audio is not running yet — this also recovers iOS "interrupted" contexts after a
 * phone call. Cheap when already running. Returns a remover.
 */
export function unlockOnGesture(target: EventTarget, isRunning: () => boolean, unlock: () => Promise<boolean>): () => void {
  let pending = false;
  const handler = (): void => {
    if (pending || isRunning()) return;
    pending = true;
    unlock()
      .catch((err: unknown) => console.warn('[audio] unlock failed', err))
      .finally(() => {
        pending = false;
      });
  };
  for (const g of GESTURES) target.addEventListener(g, handler, { capture: true, passive: true });
  return () => {
    for (const g of GESTURES) target.removeEventListener(g, handler, { capture: true });
  };
}
