import type { Lane, Vec2 } from '../../core/types';
import type { RoadNet } from './net-types';
import { ROAD_PROFILE } from './road-profile';

/** lane ids per edge: fwd[e][index] (a→b), back[e][index] (b→a); index 0 = inner lane next to the centre line */
export interface LaneIndex {
  fwd: number[][];
  back: number[][];
}

/**
 * Lanes of every edge, LEFT-hand traffic: a lane lies on the left of the centreline relative to its own travel
 * direction, so forward lanes have offset > 0 along left(dirAB) and backward lanes offset < 0. Lanes are trimmed
 * at both ends by the junction trims.
 */
export function buildLanes(net: RoadNet): { lanes: Lane[]; index: LaneIndex } {
  const lanes: Lane[] = [];
  const index: LaneIndex = { fwd: [], back: [] };
  for (const e of net.edges) {
    const a = net.nodes[e.a].pos;
    const left: Vec2 = { x: e.dir.z, z: -e.dir.x };
    const tA = net.trims[e.id * 2];
    const tB = net.trims[e.id * 2 + 1];
    const length = Math.max(0.5, e.length - tA - tB);
    const speedLimit = ROAD_PROFILE[e.cls].speedKmh / 3.6;
    const at = (s: number, l: number): Vec2 => ({ x: a.x + e.dir.x * s + left.x * l, z: a.z + e.dir.z * s + left.z * l });
    const fwd: number[] = [];
    const back: number[] = [];
    for (let i = 0; i < e.lanesAB; i++) {
      const offset = e.median / 2 + (i + 0.5) * e.laneWidth;
      fwd.push(lanes.length);
      lanes.push({
        id: lanes.length, edge: e.id, forward: true, index: i, start: at(tA, offset), end: at(tA + length, offset),
        dir: { ...e.dir }, length, width: e.laneWidth, offset, speedLimit, out: [], in: [],
      });
    }
    for (let i = 0; i < e.lanesBA; i++) {
      const offset = -(e.median / 2 + (i + 0.5) * e.laneWidth);
      back.push(lanes.length);
      lanes.push({
        id: lanes.length, edge: e.id, forward: false, index: i, start: at(tA + length, offset), end: at(tA, offset),
        dir: { x: -e.dir.x, z: -e.dir.z }, length, width: e.laneWidth, offset, speedLimit, out: [], in: [],
      });
    }
    index.fwd.push(fwd);
    index.back.push(back);
  }
  return { lanes, index };
}
