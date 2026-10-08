import type { Rng } from '../../core/rng';
import type { RoadNet } from './net-types';
import { stronglyConnected } from './state-graph';

function flipEdge(net: RoadNet, id: number): void {
  const e = net.edges[id];
  [e.a, e.b] = [e.b, e.a];
  e.dir = { x: -e.dir.x, z: -e.dir.z };
  const k = id * 2;
  [net.trims[k], net.trims[k + 1]] = [net.trims[k + 1], net.trims[k]];
}

/**
 * Turn a share of through-sois (no dead ends along them) into one-way streets, a whole soi line at a time, keeping
 * only choices that leave the network strongly connected. One-way edges are oriented so all lanes run a→b.
 */
export function chooseOneWays(net: RoadNet, share: number, spawnLine: number, rng: Rng): number {
  const byLine = new Map<number, number[]>();
  net.edges.forEach((e, i) => {
    if (e.cls !== 'soi' || net.edgeLine[i] === spawnLine) return;
    const list = byLine.get(net.edgeLine[i]) ?? [];
    list.push(i);
    byLine.set(net.edgeLine[i], list);
  });
  const eligible = [...byLine.entries()].filter(([, ids]) =>
    ids.every((id) => net.nodes[net.edges[id].a].edges.length >= 2 && net.nodes[net.edges[id].b].edges.length >= 2),
  );
  const target = eligible.length > 0 && share > 0 ? Math.max(1, Math.round(eligible.length * share)) : 0;
  let made = 0;
  for (const [, ids] of rng.shuffle(eligible)) {
    if (made >= target) break;
    const flip = rng.chance(0.5);
    const saved = ids.map((id) => ({ id, lanesAB: net.edges[id].lanesAB, lanesBA: net.edges[id].lanesBA }));
    for (const id of ids) {
      if (flip) flipEdge(net, id);
      const e = net.edges[id];
      e.oneWay = true;
      e.lanesAB = 1;
      e.lanesBA = 0;
    }
    if (stronglyConnected(net)) {
      made++;
      continue;
    }
    for (const s of saved) {
      const e = net.edges[s.id];
      e.oneWay = false;
      e.lanesAB = s.lanesAB;
      e.lanesBA = s.lanesBA;
      if (flip) flipEdge(net, s.id);
    }
  }
  return made;
}
