/**
 * Boot progress as a little Bangkok road: a cyan dashed gram route is drawn left → right while a win rider scoots along
 * it towards a coral pin. Displayed progress eases towards the target (BootProps arrive in coarse steps), so the
 * scooter never teleports; under reduced motion it jumps.
 */
import { h } from '../../core/h';
import { icon } from '../../icons/icon';
import { reducedMotion } from '../../core/motion';
import { scooterSvg } from './boot-scooter';

export interface BootRoad {
  el: HTMLElement;
  set(progress01: number): void;
  dispose(): void;
}

/** exponential approach rate (1/s) and a minimum crawl so the last few % still finish promptly */
const RATE = 5.5;
const MIN_SPEED = 0.12;

export function bootRoad(initial = 0): BootRoad {
  const pct = h('span.boot-road__pct.t-num', '0');
  const rider = h('div.boot-road__rider', h('span.boot-road__trail', { aria: { hidden: true } }), scooterSvg());
  const el = h(
    'div.boot-road',
    { role: 'progressbar', aria: { label: '로딩', valuemin: 0, valuemax: 100, valuenow: 0 } },
    h(
      'div.boot-road__lane',
      h('div.boot-road__asphalt', h('div.boot-road__route'), h('span.boot-road__pin', icon('pin', 30))),
      rider,
    ),
    h('div.boot-road__readout', pct, h('small', '%')),
  );

  let target = clamp01(initial);
  let shown = -1;
  let raf = 0;
  let last = 0;

  const paint = (p: number): void => {
    shown = p;
    el.style.setProperty('--p', p.toFixed(4));
    const n = Math.round(p * 100);
    if (pct.textContent !== String(n)) {
      pct.textContent = String(n);
      el.setAttribute('aria-valuenow', String(n));
    }
    el.classList.toggle('is-done', p >= 0.999);
  };

  const tick = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const gap = target - shown;
    const step = Math.max(gap * (1 - Math.exp(-RATE * dt)), Math.min(gap, MIN_SPEED * dt));
    paint(Math.abs(gap) < 0.0015 ? target : shown + step);
    raf = shown === target ? 0 : requestAnimationFrame(tick);
  };

  const set = (v: number): void => {
    const next = clamp01(v);
    // small dips are ignored so the scooter never reverses; a big drop is a new loading phase: restart the road
    if (next < shown - 0.5) {
      cancelAnimationFrame(raf);
      raf = 0;
      paint(next);
    }
    target = Math.max(next, Math.max(0, shown));
    if (reducedMotion() || shown < 0) {
      cancelAnimationFrame(raf);
      raf = 0;
      paint(target);
      return;
    }
    if (!raf && target !== shown) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  set(target);
  return { el, set, dispose: () => cancelAnimationFrame(raf) };
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
