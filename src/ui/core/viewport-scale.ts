/**
 * Keeps --hud-zoom / --ui-zoom on <html> in sync with the viewport (design canvas 1280×720).
 * HUD clusters use `zoom: var(--hud-zoom)` so corner widgets scale with resolution but keep their layout.
 */
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function computeZoom(w: number, h: number): { hud: number; ui: number } {
  const s = Math.min(w / 1280, h / 720);
  return { hud: clamp(s, 0.68, 1.7), ui: clamp(s, 0.8, 1.5) };
}

export function watchViewportScale(target: HTMLElement = document.documentElement): () => void {
  let raf = 0;
  const apply = (): void => {
    raf = 0;
    const { hud, ui } = computeZoom(window.innerWidth, window.innerHeight);
    target.style.setProperty('--hud-zoom', hud.toFixed(3));
    target.style.setProperty('--ui-zoom', ui.toFixed(3));
  };
  const onResize = (): void => {
    if (!raf) raf = requestAnimationFrame(apply);
  };
  apply();
  window.addEventListener('resize', onResize);
  return () => {
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(raf);
  };
}
