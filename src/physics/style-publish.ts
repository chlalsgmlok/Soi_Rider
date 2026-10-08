import type { EventBus } from '../core/events';
import type { StyleTracker, StyleUpdate } from '../logic/style';
import type { StyleEvent } from './style-events';

/**
 * Scores raw StyleSensor detections with the run's StyleTracker and announces them on the bus
 * (`nearMiss`, `perfectGap`, `filterPass`, `combo:end`). Call `tickStyle` every fixed step so combos time out.
 */
export function publishStyle(events: readonly StyleEvent[], tracker: StyleTracker, bus: EventBus): void {
  for (const e of events) {
    if (e.kind === 'nearMiss') {
      const r = tracker.nearMiss(e.clearanceCm, e.speedKmh);
      if (!r) continue;
      ended(r, bus);
      bus.emit('nearMiss', { clearanceCm: Math.round(e.clearanceCm), speedKmh: e.speedKmh, side: e.side, combo: r.combo, points: r.points });
    } else if (e.kind === 'perfectGap') {
      const r = tracker.perfectGap(e.leftCm, e.rightCm, e.speedKmh);
      if (!r) continue;
      ended(r, bus);
      bus.emit('perfectGap', { leftCm: Math.round(e.leftCm), rightCm: Math.round(e.rightCm), combo: r.combo, points: r.points });
    } else {
      tracker.filterPass();
      bus.emit('filterPass', { total: tracker.filterPasses });
    }
  }
}

/** advance the combo window; emits `combo:end` when a chain times out */
export function tickStyle(tracker: StyleTracker, dt: number, bus: EventBus): void {
  ended(tracker.update(dt), bus);
}

/** a fall or crash breaks the chain at once */
export function breakStyle(tracker: StyleTracker, bus: EventBus): void {
  ended(tracker.breakCombo(), bus);
}

function ended(r: StyleUpdate, bus: EventBus): void {
  if (r.ended) bus.emit('combo:end', { combo: r.endedCombo });
}
