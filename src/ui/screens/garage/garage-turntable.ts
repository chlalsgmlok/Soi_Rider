/**
 * Turntable drag surface over the transparent left side of the garage. Horizontal drags call onRotate(delta radians,
 * + = dragged right) with a little inertia after release; holding A / D spins it from the keyboard (wire key() from the
 * screen). Reduced motion: no inertia.
 */
import { h } from '../../core/h';
import { reducedMotion } from '../../core/motion';
import { hotkey } from '../shop/menu-keys';

const RAD_PER_PX = 0.011;
const SPIN_RAD_S = 2.4;
const FRICTION = 4.5;

export interface Turntable {
  el: HTMLElement;
  key(e: KeyboardEvent): boolean;
  dispose(): void;
}

export function turntable(onRotate: (delta: number) => void): Turntable {
  const el = h('div.g-turn.interactive', { aria: { hidden: true } });
  let dragging: number | null = null;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let spin = 0;
  let raf = 0;
  let prev = 0;

  const loop = (now: number): void => {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    if (spin) onRotate(spin * SPIN_RAD_S * dt);
    else if (dragging === null && Math.abs(velocity) > 0.04) {
      onRotate(velocity * dt);
      velocity *= Math.exp(-FRICTION * dt);
    } else velocity = 0;
    raf = spin || (dragging === null && velocity) ? requestAnimationFrame(loop) : 0;
  };
  const kick = (): void => {
    if (raf) return;
    prev = performance.now();
    raf = requestAnimationFrame(loop);
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
    lastX = e.clientX;
    lastT = performance.now();
    velocity = 0;
  });
  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragging) return;
    const now = performance.now();
    const d = (e.clientX - lastX) * RAD_PER_PX;
    const dt = Math.max(0.008, (now - lastT) / 1000);
    velocity = velocity * 0.6 + (d / dt) * 0.4;
    lastX = e.clientX;
    lastT = now;
    if (d) onRotate(d);
  });
  const end = (e: PointerEvent): void => {
    if (e.pointerId !== dragging) return;
    dragging = null;
    el.classList.remove('is-dragging');
    if (performance.now() - lastT > 90 || reducedMotion()) velocity = 0;
    else kick();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  const onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if ((k === 'a' && spin < 0) || (k === 'd' && spin > 0)) spin = 0;
  };
  window.addEventListener('keyup', onKeyUp);
  const onBlur = (): void => {
    spin = 0;
  };
  window.addEventListener('blur', onBlur);

  return {
    el,
    key(e) {
      const k = hotkey(e);
      if (k !== 'a' && k !== 'd') return false;
      spin = k === 'a' ? -1 : 1;
      velocity = 0;
      kick();
      return true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
