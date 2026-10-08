import { KMH } from '../../core/math2d';
import { type ClearanceInfo, type PlayerState, Surface } from '../../core/types';
import type { ContactReport } from '../../physics/collision-types';
import type { StyleEvent } from '../../physics/style-events';

const SURFACE_NAME: Record<number, string> = {
  [Surface.Void]: 'void', [Surface.Road]: 'road', [Surface.Sidewalk]: 'sidewalk', [Surface.Median]: 'median',
  [Surface.Building]: 'building', [Surface.Plaza]: 'plaza', [Surface.Crosswalk]: 'crosswalk', [Surface.Intersection]: 'junction',
};

const cm = (m: number): string => (Number.isFinite(m) ? `${Math.round(m * 100)} cm` : '—');
const deg = (r: number): string => `${Math.round((r * 180) / Math.PI)}°`;

/** Small debug readout for the player sandbox (speed, lean, clearance, contacts, style events). */
export class DebugPanel {
  private readonly log: string[] = [];
  private t = 0;

  constructor(private readonly el: HTMLElement) {}

  note(contacts: readonly ContactReport[], style: readonly StyleEvent[]): void {
    for (const c of contacts) this.push(`${c.heavy ? 'HEAVY' : 'hit'} ${c.kind} ${c.other} ${c.speedKmh.toFixed(0)} km/h`);
    for (const e of style) {
      if (e.kind === 'nearMiss') this.push(`near miss ${e.side} ${e.clearanceCm.toFixed(0)} cm @ ${e.speedKmh.toFixed(0)}`);
      else if (e.kind === 'perfectGap') this.push(`PERFECT GAP ${e.leftCm.toFixed(0)} | ${e.rightCm.toFixed(0)} cm`);
      else this.push(`filter pass #${e.id}`);
    }
  }

  private push(line: string): void {
    this.log.unshift(line);
    this.log.length = Math.min(this.log.length, 4);
  }

  update(dt: number, s: PlayerState, c: ClearanceInfo, extra: string): void {
    this.t += dt;
    if (this.t < 0.1) return;
    this.t = 0;
    const flags = [s.tuck && 'TUCK', s.feetDown && 'feet', s.fallen && `FALLEN ${s.fallTimer.toFixed(1)}s`,
      s.counterflow && 'COUNTERFLOW', s.slip !== 0 && Math.abs(s.slip) > 0.02 && `slip ${deg(s.slip)}`].filter(Boolean).join(' · ');
    this.el.innerHTML = `<b>${(Math.abs(s.speed) * KMH).toFixed(0)} km/h</b> · lean ${deg(s.lean)} · steer ${deg(s.steer)} · ` +
      `${SURFACE_NAME[s.surface] ?? s.surface}\nclear L ${cm(c.left)} · R ${cm(c.right)}  ${flags}\n${extra}` +
      (this.log.length ? `\n${this.log.join('\n')}` : '');
  }
}
