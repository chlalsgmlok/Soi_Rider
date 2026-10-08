import { damp } from '../../../core/math2d';

/**
 * Smoothed mouse position for subtle camera parallax: `value.x / value.y` in −1..1 (x = right, y = up). Eases toward
 * the pointer while attached and back to rest when detached or disabled (reduced motion). Touch pointers are ignored
 * (a finger drag means "rotate", not "look").
 */
export class PointerParallax {
  readonly value = { x: 0, y: 0 };
  enabled = true;
  private readonly target = { x: 0, y: 0 };
  private attached = false;

  constructor(private readonly rate = 1.6) {}

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    this.target.x = (e.clientX / Math.max(1, innerWidth)) * 2 - 1;
    this.target.y = 1 - (e.clientY / Math.max(1, innerHeight)) * 2;
  };

  attach(): void {
    if (this.attached) return;
    addEventListener('pointermove', this.onMove, { passive: true });
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    removeEventListener('pointermove', this.onMove);
    this.attached = false;
    this.target.x = 0;
    this.target.y = 0;
  }

  update(dt: number): void {
    const k = damp(this.rate, dt);
    const on = this.enabled && this.attached;
    this.value.x += ((on ? this.target.x : 0) - this.value.x) * k;
    this.value.y += ((on ? this.target.y : 0) - this.value.y) * k;
  }
}
