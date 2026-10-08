/**
 * Delegated UI sounds for every screen: pressing a .btn/.tab/.swatch/.card--interactive emits ui:sfx 'tap'
 * (override per element with data-sfx="buy|equip|deny|…", silence with data-sfx="none"); mouse hover emits 'hover'.
 * Audio itself lives in src/audio (bindAudio maps 'ui:sfx' → sounds).
 */
import type { UiSfx } from '../../core/events';

const PRESSABLE = '.btn, .tab, .swatch, .card--interactive, .toggle, [data-sfx]';
const SFX: ReadonlySet<string> = new Set<UiSfx>(['tap', 'hover', 'back', 'buy', 'deny', 'coin', 'stamp', 'ping', 'swoosh', 'equip', 'count']);

export function delegateSfx(root: HTMLElement, emit: (name: UiSfx) => void): () => void {
  let lastHover: Element | null = null;
  let lastHoverAt = 0;
  const onDown = (e: PointerEvent): void => {
    const el = (e.target as Element | null)?.closest(PRESSABLE);
    if (!el || el.matches('[disabled],[aria-disabled="true"]')) return;
    const name = (el as HTMLElement).dataset.sfx ?? 'tap';
    if (SFX.has(name)) emit(name as UiSfx);
  };
  const onOver = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    const el = (e.target as Element | null)?.closest('.btn, .tab, .card--interactive, .swatch');
    if (!el || el === lastHover || el.matches('[disabled]')) return;
    lastHover = el;
    const now = performance.now();
    if (now - lastHoverAt > 70) emit('hover');
    lastHoverAt = now;
  };
  const onOut = (e: PointerEvent): void => {
    if (lastHover && !lastHover.contains(e.relatedTarget as Node | null)) lastHover = null;
  };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerout', onOut);
  return () => {
    root.removeEventListener('pointerdown', onDown);
    root.removeEventListener('pointerover', onOver);
    root.removeEventListener('pointerout', onOut);
  };
}
