/**
 * Count-up numbers (receipts, wallet, score). rAF-driven, ease-out, cancellable.
 *   const c = countUp(el, 0, 7420, { duration: 900, format: fmtInt, onStep: () => sfx('count') });
 *   await c.done;   c.cancel() jumps to the final value.
 */
import { reducedMotion } from './motion';

export interface CountUpOpts {
  duration?: number;
  delay?: number;
  format?: (v: number) => string;
  /** called whenever the displayed integer changes (use for tick sounds; throttle inside if needed) */
  onStep?: (v: number) => void;
}

export interface CountUp {
  done: Promise<void>;
  cancel(): void;
}

export const fmtInt = (v: number): string => Math.round(v).toLocaleString('en-US');
export const fmtSigned = (v: number): string => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('en-US');
export const fmtBaht = (v: number): string => `฿${Math.round(v).toLocaleString('en-US')}`;

export function countUp(el: Element, from: number, to: number, opts: CountUpOpts = {}): CountUp {
  const { duration = 800, delay = 0, format = fmtInt, onStep } = opts;
  let raf = 0;
  let timer = 0;
  let finish: () => void = () => undefined;
  const done = new Promise<void>((res) => (finish = res));
  const write = (v: number): void => {
    el.textContent = format(v);
  };
  const end = (): void => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    write(to);
    finish();
  };
  if (reducedMotion() || duration <= 0 || from === to) {
    end();
    return { done, cancel: end };
  }
  write(from);
  let last = Math.round(from);
  const start = (): void => {
    const t0 = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - (1 - t) ** 3;
      const v = from + (to - from) * e;
      write(v);
      const r = Math.round(v);
      if (r !== last) {
        last = r;
        onStep?.(r);
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else end();
    };
    raf = requestAnimationFrame(tick);
  };
  if (delay > 0) timer = window.setTimeout(start, delay);
  else start();
  return { done, cancel: end };
}
