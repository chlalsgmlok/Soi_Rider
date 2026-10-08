import type { Connector, Lane } from '../../core/types';

/**
 * Lanes that can be reached from `start` AND can get back to it, following connectors plus lane changes to an
 * adjacent lane of the same edge and direction (how the navigator and traffic move). 1 = mutually reachable.
 */
export function laneReach(lanes: readonly Lane[], connectors: readonly Connector[], start: number): Uint8Array {
  const sibling = new Map<string, number>();
  for (const l of lanes) sibling.set(`${l.edge}:${l.forward ? 1 : 0}:${l.index}`, l.id);
  const fwd: number[][] = lanes.map(() => []);
  const back: number[][] = lanes.map(() => []);
  const link = (a: number, b: number): void => {
    fwd[a].push(b);
    back[b].push(a);
  };
  for (const l of lanes) {
    for (const c of l.out) link(l.id, connectors[c].to);
    for (const di of [-1, 1]) {
      const s = sibling.get(`${l.edge}:${l.forward ? 1 : 0}:${l.index + di}`);
      if (s !== undefined) link(l.id, s);
    }
  }
  const walk = (adj: number[][]): Uint8Array => {
    const seen = new Uint8Array(lanes.length);
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const id = stack.pop() as number;
      for (const t of adj[id]) if (!seen[t]) (seen[t] = 1), stack.push(t);
    }
    return seen;
  };
  const a = walk(fwd);
  const b = walk(back);
  return a.map((v, i) => v & b[i]);
}
