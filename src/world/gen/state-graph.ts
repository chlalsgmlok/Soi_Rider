import { movement } from './movement';
import type { MovementNet } from './net-types';

/**
 * Directed graph over edge-direction states (state = 2·edge + (forward ? 0 : 1)). Lane changes within one edge
 * direction are free, so these states capture lane-level reachability with lane changing.
 */
export interface StateGraph {
  adj: number[][];
  valid: boolean[];
}

export function buildStateGraph(net: MovementNet): StateGraph {
  const { edges, nodes } = net;
  const valid = new Array<boolean>(edges.length * 2).fill(false);
  for (const e of edges) {
    valid[e.id * 2] = e.lanesAB > 0;
    valid[e.id * 2 + 1] = e.lanesBA > 0;
  }
  const adj: number[][] = valid.map(() => []);
  for (const e of edges) {
    for (const fwd of [true, false]) {
      const s = e.id * 2 + (fwd ? 0 : 1);
      if (!valid[s]) continue;
      const n = nodes[fwd ? e.b : e.a];
      for (const fid of n.edges) {
        const f = edges[fid];
        const outs = f.a === f.b ? [] : [f.a === n.id ? 0 : 1];
        for (const o of outs) {
          const s2 = fid * 2 + o;
          if (valid[s2] && movement(net, n, e, f) !== null) adj[s].push(s2);
        }
      }
    }
  }
  return { adj, valid };
}

/** states reachable from `start` (forward) */
export function reachable(g: StateGraph, start: number, reverse = false): Uint8Array {
  const adj = reverse ? reversed(g) : g.adj;
  const seen = new Uint8Array(g.valid.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const s = stack.pop() as number;
    for (const t of adj[s]) {
      if (!seen[t]) {
        seen[t] = 1;
        stack.push(t);
      }
    }
  }
  return seen;
}

function reversed(g: StateGraph): number[][] {
  const r: number[][] = g.valid.map(() => []);
  g.adj.forEach((list, s) => list.forEach((t) => r[t].push(s)));
  return r;
}

/** every valid state can reach every other valid state */
export function stronglyConnected(net: MovementNet): boolean {
  const g = buildStateGraph(net);
  const start = g.valid.indexOf(true);
  if (start < 0) return false;
  const fw = reachable(g, start);
  const bw = reachable(g, start, true);
  return g.valid.every((v, s) => !v || (fw[s] === 1 && bw[s] === 1));
}
