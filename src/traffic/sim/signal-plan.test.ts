import { describe, expect, it } from 'vitest';
import { INTENSITY } from '../../core/config/traffic';
import { Rng } from '../../core/rng';
import { city } from '../../world/gen/test-fixtures';
import {
  ALL_RED_SEC, greenTime, lampFor, lampForPhase, MIN_GREEN_SEC, type PhaseState, phaseAt, phaseName, walkTimeLeft,
  YELLOW_SEC,
} from './signal-plan';
import { SignalBank } from './signals';

const st = (): PhaseState => ({ group: 0, stage: 'green', remaining: 0, greenLeft: 0 });

/** walk one cycle stage by stage (jumping by `remaining`) and return the [phase, duration] sequence */
function sequence(cycle: number): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  const p = st();
  let t = 1e-6;
  while (t < cycle) {
    phaseAt(t, cycle, 2, p);
    const d = p.remaining;
    out.push([phaseName(p), Math.round((d + (out.length === 0 ? t : 0)) * 1000) / 1000]);
    t += d + 1e-6;
  }
  return out;
}

describe('signal phase timing', () => {
  it('runs ns green → amber → all-red → ew green → amber → all-red within INTENSITY.signalCycle', () => {
    for (const id of ['light', 'rush', 'gridlock'] as const) {
      const cycle = INTENSITY[id].signalCycle;
      const g = cycle / 2 - YELLOW_SEC - ALL_RED_SEC;
      expect(greenTime(cycle, 2)).toBeCloseTo(g, 9);
      expect(sequence(cycle)).toEqual([
        ['ns_green', g], ['ns_yellow', YELLOW_SEC], ['all_red', ALL_RED_SEC],
        ['ew_green', g], ['ew_yellow', YELLOW_SEC], ['all_red', ALL_RED_SEC],
      ]);
    }
  });

  it('counts the remaining time down and repeats every cycle', () => {
    const a = phaseAt(3, 45, 2, st());
    const b = phaseAt(4, 45, 2, st());
    expect(a.stage).toBe('green');
    expect(a.remaining - b.remaining).toBeCloseTo(1, 9);
    expect(phaseName(phaseAt(3 + 45 * 7, 45, 2, st()))).toBe(phaseName(a));
    expect(phaseAt(3 + 45 * 7, 45, 2, st()).remaining).toBeCloseTo(a.remaining, 6);
  });

  it('never shortens a green below the minimum on tiny cycles', () => {
    expect(greenTime(8, 2)).toBe(MIN_GREEN_SEC);
  });

  it('shows each approach group its own lamp and gives pedestrians the held arm', () => {
    const p = phaseAt(1, 30, 2, st());
    expect(lampFor(p, 0)).toBe('green');
    expect(lampFor(p, 1)).toBe('red');
    expect(lampForPhase(phaseName(p), 0)).toBe('green');
    expect(lampForPhase(phaseName(p), 1)).toBe('red');
    // arm of group 1 is held → people may cross it, never the moving arm
    expect(walkTimeLeft(p, 1)).toBeGreaterThan(5);
    expect(walkTimeLeft(p, 0)).toBe(0);
    const red = phaseAt(greenTime(30, 2) + YELLOW_SEC + 0.5, 30, 2, st());
    expect(red.stage).toBe('all_red');
    expect(lampFor(red, 0)).toBe('red');
    expect(lampFor(red, 1)).toBe('red');
  });

  it('staggers junction offsets and publishes SignalViews per signalised node', () => {
    const c = city(2, 'sukhumvit');
    const bank = new SignalBank(c, new Rng(9), 45);
    const nodes = c.nodes.filter((n) => n.signal);
    expect(nodes.length).toBeGreaterThan(1);
    const offsets = new Set(nodes.map((n) => bank.controller(n.id)?.offset.toFixed(3)));
    expect(offsets.size).toBe(nodes.length);
    for (const n of nodes) expect(bank.view(n.id)?.node).toBe(n.id);
    expect(bank.view(c.nodes.find((n) => !n.signal)?.id ?? -1)).toBeNull();
    const v = bank.view(nodes[0].id);
    const before = v?.remaining ?? 0;
    bank.update(0.5);
    const after = bank.view(nodes[0].id)?.remaining ?? 0;
    // counts down by the elapsed time, or a new stage started (remaining jumped up)
    expect(Math.abs(after - (before - 0.5)) < 1e-9 || after > before).toBe(true);
  });
});
