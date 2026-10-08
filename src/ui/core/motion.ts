/**
 * Reduced-motion policy. The OS preference applies unless the player's setting overrides it
 * (Settings.reducedMotion → setReducedMotion(true); null restores "follow the OS").
 * Mirrors the state onto <html data-motion="reduced|full"> so CSS can react (see base.css).
 */
let override: boolean | null = null;
const listeners = new Set<(reduced: boolean) => void>();
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function reducedMotion(): boolean {
  return override ?? media?.matches ?? false;
}

function sync(): void {
  const root = document.documentElement;
  if (override === null) delete root.dataset.motion;
  else root.dataset.motion = override ? 'reduced' : 'full';
  const v = reducedMotion();
  for (const fn of listeners) fn(v);
}

export function setReducedMotion(value: boolean | null): void {
  override = value;
  sync();
}

export function onMotionChange(fn: (reduced: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

media?.addEventListener('change', sync);

/** convenience: duration scaled to 0 when motion is reduced */
export const dur = (ms: number): number => (reducedMotion() ? 0 : ms);

export const EASE = {
  out: 'cubic-bezier(.2,.8,.2,1)',
  pop: 'cubic-bezier(.34,1.56,.64,1)',
  in: 'cubic-bezier(.5,0,.75,0)',
  inout: 'cubic-bezier(.65,0,.35,1)',
} as const;

export const DUR = { tap: 120, chip: 220, card: 360, screen: 600, hero: 900, wipe: 450 } as const;
