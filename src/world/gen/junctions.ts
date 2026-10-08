import type { RoadNode } from '../../core/types';
import type { RoadNet } from './net-types';
import { bulbRadius, halfWidth } from './road-profile';
import { dirFrom, onBounds } from './road-geometry';

/** stop line + crosswalk band before a signalised junction */
export const SIGNAL_PAD = 4.5;
/** corner clearance at unsignalised junctions */
export const CORNER_PAD = 1.2;
/** lanes stop this far before a dead end; the U-turn loops into the turnaround bulb */
export const DEAD_END_TRIM = 4.5;
/** half length of a median U-turn gap */
export const OPENING_TRIM = 4.5;

/** signals at main×main, main×avenue and avenue×avenue (two different major lines meet); sois stay unsignalised */
export function isSignalised(net: RoadNet, n: RoadNode): boolean {
  if (n.edges.length < 3) return false;
  const majors = new Set(n.edges.filter((id) => net.edges[id].cls !== 'soi').map((id) => net.edgeLine[id]));
  return majors.size >= 2;
}

/**
 * Signals, per-edge lane trims (how far lanes stop from each node so they clear every crossing carriageway plus a
 * crosswalk at signals) and node radius = the largest trim (the intersection box half size).
 */
export function computeJunctions(net: RoadNet): void {
  const { edges, trims } = net;
  for (const n of net.nodes) {
    n.signal = isSignalised(net, n);
    const set = (eid: number, t: number): void => {
      trims[edges[eid].a === n.id ? eid * 2 : eid * 2 + 1] = t;
    };
    if (n.edges.length === 1) {
      const e = edges[n.edges[0]];
      const exit = onBounds(n.pos, net.bounds);
      set(e.id, exit ? 0 : DEAD_END_TRIM);
      n.radius = exit ? halfWidth(e) : bulbRadius(e);
      continue;
    }
    if (net.openings.has(n.id)) {
      for (const id of n.edges) set(id, OPENING_TRIM);
      n.radius = OPENING_TRIM;
      continue;
    }
    let radius = 0;
    for (const id of n.edges) {
      const e = edges[id];
      const d = dirFrom(e, n.id);
      let t = CORNER_PAD;
      for (const fid of n.edges) {
        if (fid === id) continue;
        const f = edges[fid];
        const df = dirFrom(f, n.id);
        const s = Math.abs(d.x * df.z - d.z * df.x);
        if (s < 0.42) continue;
        const c = Math.abs(d.x * df.x + d.z * df.z);
        t = Math.max(t, halfWidth(f) / s + (halfWidth(e) * c) / s + (n.signal ? SIGNAL_PAD : CORNER_PAD));
      }
      set(id, t);
      radius = Math.max(radius, t);
    }
    n.radius = radius;
  }
  for (const e of edges) {
    const sum = trims[e.id * 2] + trims[e.id * 2 + 1];
    if (sum <= e.length - 2) continue;
    const k = (e.length - 2) / sum;
    trims[e.id * 2] *= k;
    trims[e.id * 2 + 1] *= k;
  }
}
