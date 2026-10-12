/**
 * "+1 29:59" countdown to the next free fuel on every visible ⛽ chip. One shared 1 s ticker for all chips; a chip that
 * has been on the page and then left it is dropped, and the ticker stops when nothing is watched.
 */
import type { SaveData } from '../../../core/types/save';
import { fmtRegen, fuelRegenLeftMs } from '../../../logic/fuel-regen';

interface Watch {
  el: HTMLElement;
  save: () => SaveData;
  seen: boolean;
}

const watched = new Set<Watch>();
let ticker = 0;

function paint(w: Watch, now: number): void {
  const left = fuelRegenLeftMs(w.save(), now);
  w.el.hidden = left === null;
  if (left !== null) w.el.textContent = `+1 ${fmtRegen(left)}`;
}

function tick(): void {
  const now = Date.now();
  for (const w of watched) {
    if (w.el.isConnected) w.seen = true;
    else if (w.seen) {
      watched.delete(w);
      continue;
    }
    paint(w, now);
  }
  if (watched.size === 0) {
    window.clearInterval(ticker);
    ticker = 0;
  }
}

/** keep `el` showing the countdown for whatever save `save()` returns */
export function watchRegen(el: HTMLElement, save: () => SaveData): void {
  const w: Watch = { el, save, seen: false };
  watched.add(w);
  paint(w, Date.now());
  if (!ticker) ticker = window.setInterval(tick, 1000);
}
