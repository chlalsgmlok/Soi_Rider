/**
 * gram "choose a call" countdown: a draining bar (cyan → amber → coral) + whole seconds. The timing lives in the DOM-free
 * CountdownClock (unit-tested): it fires onSecond when the displayed second changes and onExpire exactly once at zero;
 * a stopped clock never expires. countdown() wraps it in the gram timer row, driven by requestAnimationFrame.
 */
import { h } from '../../core/h';

export interface CountdownEvents {
  onSecond?(left: number): void;
  onExpire(): void;
}

export interface ClockFrame {
  /** seconds left (≥ 0) */
  left: number;
  /** fraction of the bar still filled, 1 → 0 */
  k: number;
  /** whole seconds shown */
  sec: number;
  warn: boolean;
  urgent: boolean;
}

/** last five seconds turn the bar coral; below 40 % (but before that) amber */
const URGENT_SEC = 5;
const WARN_K = 0.4;

export class CountdownClock {
  readonly total: number;
  private t0 = 0;
  private shown: number;
  private phase: 'idle' | 'running' | 'stopped' | 'expired' = 'idle';

  constructor(
    totalSec: number,
    private readonly ev: CountdownEvents,
  ) {
    this.total = Math.max(1, totalSec);
    this.shown = Math.ceil(this.total);
  }

  get running(): boolean {
    return this.phase === 'running';
  }

  /** begin at `now` (ms); a clock starts once — false if it already ran or was stopped */
  start(now: number): boolean {
    if (this.phase !== 'idle') return false;
    this.phase = 'running';
    this.t0 = now;
    return true;
  }

  stop(): void {
    if (this.phase !== 'expired') this.phase = 'stopped';
  }

  /** advance to `now` (ms): fires the events and returns what to paint, or null when not running */
  frame(now: number): ClockFrame | null {
    if (this.phase !== 'running') return null;
    const left = Math.max(0, this.total - (now - this.t0) / 1000);
    const k = left / this.total;
    const sec = Math.ceil(left);
    if (sec !== this.shown) {
      this.shown = sec;
      this.ev.onSecond?.(sec);
    }
    if (left <= 0 && this.phase === 'running') {
      this.phase = 'expired';
      this.ev.onExpire();
    }
    return { left, k, sec, warn: k < WARN_K && left > URGENT_SEC, urgent: left <= URGENT_SEC };
  }
}

export interface Countdown {
  el: HTMLElement;
  start(): void;
  stop(): void;
  dispose(): void;
}

export function countdown(totalSec: number, o: CountdownEvents): Countdown {
  const clock = new CountdownClock(totalSec, o);
  const fill = h('span.gram-timer__fill');
  const num = h('b.gram-timer__num.t-num', String(Math.ceil(clock.total)));
  const el = h(
    'div.gram-timer',
    { role: 'timer', aria: { label: '남은 선택 시간' } },
    h('div.gram-timer__row', h('span.gram-timer__hint', '시간이 지나면 첫 콜 자동 수락'), h('span.gram-timer__left', num, h('small', '초'))),
    h('div.gram-timer__track', fill),
  );
  let raf = 0;

  const loop = (now: number): void => {
    const f = clock.frame(now);
    if (!f) return;
    fill.style.transform = `scaleX(${f.k.toFixed(4)})`;
    el.classList.toggle('is-warn', f.warn);
    el.classList.toggle('is-urgent', f.urgent);
    if (num.textContent !== String(f.sec)) num.textContent = String(f.sec);
    if (clock.running) raf = requestAnimationFrame(loop);
  };

  return {
    el,
    start() {
      if (clock.start(performance.now())) raf = requestAnimationFrame(loop);
    },
    stop() {
      clock.stop();
      cancelAnimationFrame(raf);
      el.classList.add('is-stopped');
    },
    dispose() {
      clock.stop();
      cancelAnimationFrame(raf);
    },
  };
}
