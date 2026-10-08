import type { Rng } from '../../core/rng';
import type { CityData, SignalView, Vec2 } from '../../core/types';
import { type LampState, lampFor, type PhaseState, phaseAt, phaseName, walkTimeLeft } from './signal-plan';

/** One fixed-time controller per signalised junction. */
export class SignalController {
  readonly view: SignalView;
  readonly state: PhaseState = { group: 0, stage: 'green', remaining: 0, greenLeft: 0 };
  readonly groups: number;

  constructor(readonly node: number, readonly edgeGroup: ReadonlyMap<number, number>, readonly offset: number) {
    let g = 0;
    for (const v of edgeGroup.values()) g = Math.max(g, v + 1);
    this.groups = Math.max(2, g);
    this.view = { node, phase: 'ns_green', remaining: 0 };
  }

  update(clock: number, cycle: number): void {
    phaseAt(clock + this.offset, cycle, this.groups, this.state);
    this.view.phase = phaseName(this.state);
    this.view.remaining = this.state.remaining;
  }

  /** lamp for traffic arriving along `edge` */
  lamp(edge: number): LampState {
    return lampFor(this.state, this.edgeGroup.get(edge) ?? 0);
  }

  /** protected pedestrian time left to cross the arm `edge` (0 = wait) */
  walkLeft(edge: number): number {
    return walkTimeLeft(this.state, this.edgeGroup.get(edge) ?? 0);
  }
}

/**
 * Phase group of an approach — the convention shared with src/world/build (signal-phase.ts `approachAxis`): roads
 * running mostly along world Z belong to the 'ns' phase (group 0), the others to 'ew' (group 1).
 */
export function approachGroup(dir: Vec2): 0 | 1 {
  return Math.abs(dir.z) >= Math.abs(dir.x) ? 0 : 1;
}

/** Every signal of the city, fixed-time, with offsets staggered from the rng. */
export class SignalBank {
  private readonly byNode = new Map<number, SignalController>();
  private clock = 0;
  private cycle: number;

  constructor(city: CityData, rng: Rng, cycle: number) {
    this.cycle = cycle;
    for (const n of city.nodes) {
      if (!n.signal) continue;
      const groups = new Map<number, number>();
      for (const id of n.edges) groups.set(id, approachGroup(city.edges[id].dir));
      this.byNode.set(n.id, new SignalController(n.id, groups, rng.range(0, cycle)));
    }
    this.update(0);
  }

  get time(): number {
    return this.clock;
  }

  setCycle(cycle: number): void {
    this.cycle = cycle;
  }

  update(dt: number): void {
    this.clock += dt;
    for (const c of this.byNode.values()) c.update(this.clock, this.cycle);
  }

  controller(node: number): SignalController | undefined {
    return this.byNode.get(node);
  }

  view(node: number): SignalView | null {
    return this.byNode.get(node)?.view ?? null;
  }

  /** lamp for traffic arriving at `node` along `edge` ('green' at unsignalised nodes) */
  lamp(node: number, edge: number): LampState {
    return this.byNode.get(node)?.lamp(edge) ?? 'green';
  }

  all(): IterableIterator<SignalController> {
    return this.byNode.values();
  }
}
