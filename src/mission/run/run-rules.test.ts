import { describe, expect, it } from 'vitest';
import type { CityData, SignalPhase } from '../../core/types';
import { ARRIVE_METERS, BOARD_SEC, DROP_SEC, type FlowInput, PhaseFlow, STOP_HOLD } from './phase-flow';
import { CROSS_MARGIN, RedLightWatch } from './red-light-watch';
import { PROMPT_WINDOW, type PromptEvent, type PromptInput, StoryPrompts } from './story-prompts';

const DT = 1 / 60;
const run = (sec: number, fn: () => void): void => {
  for (let i = 0; i < Math.round(sec / DT); i++) fn();
};

describe('PhaseFlow', () => {
  const at = (d: number, speed: number, remaining = d): FlowInput => ({ distToTarget: d, remaining, speed, fallen: false });

  it('walks intro → toPickup → boarding → toDropoff → arriving → complete', () => {
    const f = new PhaseFlow();
    const seen: string[] = [];
    const note = (s: string | null): void => {
      if (s) seen.push(s);
    };
    note(f.update(DT, at(2, 0)));
    expect(f.phase).toBe('intro');
    note(f.start());
    run(STOP_HOLD + 0.05, () => note(f.update(DT, at(3, 0.5))));
    expect(f.phase).toBe('boarding');
    expect(f.scripted).toBe(true);
    // once boarded the target is the far-away drop
    run(BOARD_SEC + 0.05, () => note(f.update(DT, at(300, 0, 500))));
    expect(f.phase).toBe('toDropoff');
    expect(f.aboard).toBe(true);
    note(f.update(DT, at(300, 8, ARRIVE_METERS - 1)));
    expect(f.phase).toBe('arriving');
    run(STOP_HOLD + 0.05, () => note(f.update(DT, at(1.2, 0.2))));
    expect(f.dropping).toBe(true);
    expect(f.aboard).toBe(false);
    run(DROP_SEC + 0.05, () => note(f.update(DT, at(1.2, 0))));
    expect(seen).toEqual(['toPickup', 'boarding', 'toDropoff', 'arriving', 'dropStart', 'complete']);
  });

  it('needs the stop held for 0.6 s inside 4 m below 1.5 m/s', () => {
    const f = new PhaseFlow();
    f.start();
    run(2, () => f.update(DT, at(5, 0)));
    expect(f.phase).toBe('toPickup');
    run(2, () => f.update(DT, at(2, 2)));
    expect(f.phase).toBe('toPickup');
    run(STOP_HOLD - 0.1, () => f.update(DT, at(2, 1)));
    f.update(DT, at(2, 3));
    run(STOP_HOLD - 0.1, () => f.update(DT, at(2, 1)));
    expect(f.phase).toBe('toPickup');
    run(0.2, () => f.update(DT, at(2, 1)));
    expect(f.phase).toBe('boarding');
  });

  it('holds a scripted moment until the hook settles (capped)', () => {
    const f = new PhaseFlow();
    f.start();
    run(STOP_HOLD + 0.05, () => f.update(DT, at(1, 0)));
    f.awaitScene();
    run(BOARD_SEC + 1, () => f.update(DT, at(1, 0)));
    expect(f.phase).toBe('boarding');
    f.sceneFinished();
    f.update(DT, at(1, 0));
    expect(f.phase).toBe('toDropoff');
  });

  it('falls back to toDropoff after overshooting the drop, and fails from any live phase', () => {
    const f = new PhaseFlow();
    f.start();
    run(STOP_HOLD + 0.05, () => f.update(DT, at(1, 0)));
    run(BOARD_SEC + 0.05, () => f.update(DT, at(1, 0)));
    f.update(DT, at(20, 5, 30));
    expect(f.phase).toBe('arriving');
    f.update(DT, at(60, 5, 120));
    expect(f.phase).toBe('toDropoff');
    expect(f.fail()).toBe('failed');
    expect(f.live).toBe(false);
    expect(f.fail()).toBeNull();
  });
});

describe('StoryPrompts', () => {
  const base: PromptInput = { aboard: true, stopped: false, interact: false, raining: false, smoggy: false };
  const collect = (p: StoryPrompts, sec: number, i: PromptInput): PromptEvent[] => {
    const out: PromptEvent[] = [];
    run(sec, () => out.push(...p.update(DT, i)));
    return out;
  };

  it('offers the raincoat when a downpour starts and succeeds on stop + interact inside the window', () => {
    const p = new StoryPrompts('E');
    const opened = collect(p, 0.1, { ...base, raining: true });
    expect(opened[0]).toMatchObject({ kind: 'open', prompt: { id: 'raincoat', key: 'E', progress: 1 } });
    collect(p, 3, { ...base, raining: true });
    expect(p.active?.progress ?? 0).toBeCloseTo(1 - 3.1 / PROMPT_WINDOW, 1);
    // pressing while still rolling only nudges
    expect(p.update(DT, { ...base, raining: true, interact: true })[0]).toMatchObject({ kind: 'needStop' });
    const done = p.update(DT, { ...base, raining: true, stopped: true, interact: true });
    expect(done).toEqual([{ kind: 'resolve', id: 'raincoat', success: true }]);
    expect(p.given('raincoat')).toBe(true);
    expect(collect(p, 20, { ...base, raining: true })).toEqual([]);
  });

  it('misses after 8 s without the hand-over, and re-arms on the next event', () => {
    const p = new StoryPrompts();
    const ev = collect(p, PROMPT_WINDOW + 0.2, { ...base, smoggy: true });
    expect(ev.map((e) => e.kind)).toEqual(['open', 'resolve']);
    expect(ev[1]).toMatchObject({ id: 'mask', success: false });
    expect(collect(p, 2, { ...base, smoggy: true })).toEqual([]);
    collect(p, 1, base);
    expect(collect(p, 0.1, { ...base, smoggy: true })[0]).toMatchObject({ kind: 'open', prompt: { id: 'mask' } });
  });

  it('waits for the passenger to be aboard before offering', () => {
    const p = new StoryPrompts();
    expect(collect(p, 5, { ...base, aboard: false, raining: true })).toEqual([]);
    expect(collect(p, 0.1, { ...base, raining: true })[0]).toMatchObject({ kind: 'open' });
  });
});

describe('RedLightWatch', () => {
  // one northbound approach (dir +z) ending at a signalised junction at z = 0; lane end (stop line) at z = −8
  const data = {
    nodes: [
      { id: 0, pos: { x: 0, z: -100 }, edges: [0], signal: false, radius: 6 },
      { id: 1, pos: { x: 0, z: 0 }, edges: [0], signal: true, radius: 8 },
    ],
    edges: [{ id: 0, a: 0, b: 1, dir: { x: 0, z: 1 } }],
    lanes: [{ id: 0, edge: 0, forward: true, index: 0, start: { x: 1.6, z: -94 }, end: { x: 1.6, z: -8 }, dir: { x: 0, z: 1 }, length: 86, width: 3.2 }],
  } as unknown as CityData;
  const ride = (phase: SignalPhase, x = 1.6, counterflow = false): number[] => {
    const w = new RedLightWatch(data);
    const hits: number[] = [];
    for (let z = -30; z < 5; z += 0.25) {
      const n = w.update({ pos: { x, z }, speed: 6, laneId: 0, counterflow }, () => ({ node: 1, phase, remaining: 10 }));
      if (n >= 0) hits.push(n);
    }
    return hits;
  };

  it('reports the node when the stop line is crossed on red (incl. all-red), once', () => {
    expect(ride('ew_green')).toEqual([1]);
    expect(ride('all_red')).toEqual([1]);
  });

  it('allows green and amber', () => {
    expect(ride('ns_green')).toEqual([]);
    expect(ride('ns_yellow')).toEqual([]);
  });

  it('ignores counterflow and crossings beside the carriageway', () => {
    expect(ride('ew_green', 1.6, true)).toEqual([]);
    expect(ride('ew_green', 12)).toEqual([]);
  });

  it('does not count a nose over the line while waiting', () => {
    const w = new RedLightWatch(data);
    const sig = (): { node: number; phase: SignalPhase; remaining: number } => ({ node: 1, phase: 'ew_green', remaining: 9 });
    let hits = 0;
    for (let z = -20; z <= -8 + CROSS_MARGIN * 0.6; z += 0.1) if (w.update({ pos: { x: 1.6, z }, speed: 3, laneId: 0, counterflow: false }, sig) >= 0) hits++;
    expect(hits).toBe(0);
  });
});
