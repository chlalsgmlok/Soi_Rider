import type { RoadEdge, RoadNode, TurnKind, Vec2 } from '../../core/types';
import { angleDiff, headingOf } from '../../core/math2d';
import type { MovementNet } from './net-types';

/** number of lanes of e that arrive at node n */
export const arriving = (e: RoadEdge, n: number): number => (e.b === n ? e.lanesAB : e.a === n ? e.lanesBA : 0);
/** number of lanes of e that leave node n */
export const leaving = (e: RoadEdge, n: number): number => (e.a === n ? e.lanesAB : e.b === n ? e.lanesBA : 0);

/** travel direction of traffic arriving at n along e */
export const travelIn = (e: RoadEdge, n: number): Vec2 => (e.b === n ? e.dir : { x: -e.dir.x, z: -e.dir.z });
/** travel direction of traffic leaving n along e */
export const travelOut = (e: RoadEdge, n: number): Vec2 => (e.a === n ? e.dir : { x: -e.dir.x, z: -e.dir.z });

/** left turn = heading increases (see core/types/geometry.ts) */
export function turnKind(dIn: Vec2, dOut: Vec2): TurnKind {
  const phi = angleDiff(headingOf(dIn), headingOf(dOut));
  if (Math.abs(phi) < 0.55) return 'straight';
  if (Math.abs(phi) > 2.7) return 'uturn';
  return phi > 0 ? 'left' : 'right';
}

/**
 * Legal movement from eIn into eOut at node n (Thai rules, left-hand traffic), or null:
 * - U-turns only at dead ends / exits and at median openings;
 * - signalised junctions and medianless junctions allow straight / left / right;
 * - where a raised median passes an unsignalised soi mouth: left-in / left-out only, straight only along the main road.
 */
export function movement(net: MovementNet, n: RoadNode, eIn: RoadEdge, eOut: RoadEdge): TurnKind | null {
  if (arriving(eIn, n.id) === 0 || leaving(eOut, n.id) === 0) return null;
  const deg = n.edges.length;
  if (eIn.id === eOut.id) return deg === 1 || net.openings.has(n.id) ? 'uturn' : null;
  if (deg === 1) return null;
  const kind = turnKind(travelIn(eIn, n.id), travelOut(eOut, n.id));
  if (kind === 'uturn') return null;
  if (n.signal || deg === 2) return kind;
  const median = n.edges.some((id) => net.edges[id].median > 0);
  if (!median || kind === 'left') return kind;
  if (kind === 'straight') return eIn.median > 0 && eOut.median > 0 ? kind : null;
  return null;
}
