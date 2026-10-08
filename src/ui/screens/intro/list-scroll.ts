/**
 * Keeps a call card fully visible inside the scrolling gram call list while its drawer animates open. The list only
 * scrolls when the phone is bounded by a short window (landscape phones); it may also run a little past the bottom
 * edge (the handset is "held" below the screen), so the visible bottom is clamped to the window. The card's top wins
 * when it is taller than the visible list.
 */
const PAD = 8;

/** scroll delta (screen px) that brings [top, bottom] inside [viewTop, viewBottom]; top-aligned when it can't fit */
export function revealDelta(top: number, bottom: number, viewTop: number, viewBottom: number): number {
  if (top < viewTop) return top - viewTop;
  if (bottom > viewBottom) return Math.min(bottom - viewBottom, top - viewTop);
  return 0;
}

function nudge(list: HTMLElement, el: HTMLElement): void {
  if (!el.isConnected || list.scrollHeight <= list.clientHeight + 1) return;
  const lr = list.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  // screen px per list px (the phone is CSS-zoomed)
  const scale = list.clientHeight > 0 ? lr.height / list.clientHeight : 1;
  const d = revealDelta(er.top, er.bottom, lr.top + PAD * scale, Math.min(lr.bottom, window.innerHeight) - PAD * scale);
  if (Math.abs(d) > 0.5) list.scrollTop += d / scale;
}

/** follow `el` for `ms` (its height may still be animating); returns a cancel function */
export function keepInView(list: HTMLElement, el: HTMLElement, ms = 420): () => void {
  const t0 = performance.now();
  let raf = 0;
  const step = (now: number): void => {
    nudge(list, el);
    raf = now - t0 < ms ? requestAnimationFrame(step) : 0;
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
