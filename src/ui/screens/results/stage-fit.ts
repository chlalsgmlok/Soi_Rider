/**
 * Keeps the zoomed Results stage inside the window. The stage is authored at 1280×720 and scaled by --ui-zoom, which
 * bottoms out at 0.8, so very short screens (360–390 px landscape phones) can still overflow even with the compact
 * CSS. When the laid-out stage exceeds the viewport (minus padding), --res-fit (< 1) shrinks it further:
 *   .results__stage { zoom: calc(var(--ui-zoom) * var(--res-fit, 1)) }
 * The stage's layout is static during the reveal (hidden parts keep their space), so measuring per resize suffices.
 */
export interface FitOpts {
  /** screen px kept free above and below */
  padY: number;
  /** screen px kept free left and right */
  padX: number;
  /** never shrink below this factor */
  min: number;
}

/** the factor that makes a `w`×`h` box (measured at factor `fit`) fit the room; clamped to [min, 1] */
export function fitFactor(box: { w: number; h: number }, fit: number, room: { w: number; h: number }, min: number): number {
  if (box.w <= 0 || box.h <= 0) return fit;
  const k = Math.min(room.h / (box.h / fit), room.w / (box.w / fit));
  return Math.max(min, Math.min(1, k));
}

export function fitStage(stage: HTMLElement, o: FitOpts): () => void {
  let fit = 1;
  let raf = 0;
  const apply = (): void => {
    raf = 0;
    if (!stage.isConnected) return;
    const r = stage.getBoundingClientRect();
    const room = { w: window.innerWidth - 2 * o.padX, h: window.innerHeight - 2 * o.padY };
    const next = fitFactor({ w: r.width, h: r.height }, fit, room, o.min);
    if (Math.abs(next - fit) < 0.005) return;
    fit = next;
    stage.style.setProperty('--res-fit', fit.toFixed(3));
  };
  // two frames: viewport-scale writes the new --ui-zoom on the first frame after a resize
  const schedule = (): void => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => (raf = requestAnimationFrame(apply)));
  };
  apply();
  window.addEventListener('resize', schedule);
  void document.fonts.ready.then(schedule);
  return () => {
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(raf);
  };
}
