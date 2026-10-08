import type { Vector3 } from 'three';
import { KMH } from '../../core/math2d';
import type { ClearanceInfo, PlayerState } from '../../core/types';
import type { EngineStats } from '../../engine/engine-stats';

/** What the player sandbox publishes on window.__stats (headless screenshot steps wait on these). */
export interface ArenaStatsInput {
  t: number;
  s: PlayerState;
  clearance: ClearanceInfo;
  contacts: number;
  lastContact: string;
  pose: string;
  mode: string;
  squeeze: number;
  phase: string;
  bike: string;
  engine: EngineStats;
  camera: Vector3;
}

const r = (v: number, d: number): number => +v.toFixed(d);

export function arenaStats(i: ArenaStatsInput): Record<string, number | string | boolean> {
  const { s, engine: e } = i;
  return {
    t: r(i.t, 2), speedKmh: r(Math.abs(s.speed) * KMH, 1), leanDeg: r((s.lean * 180) / Math.PI, 1),
    clearL: r(i.clearance.left, 3), clearR: r(i.clearance.right, 3), x: r(s.pos.x, 2), z: r(s.pos.z, 2),
    contacts: i.contacts, lastContact: i.lastContact, fallen: s.fallen, fallTimer: r(s.fallTimer, 2), pose: i.pose,
    mode: i.mode, squeeze: r(i.squeeze, 2), phase: i.phase, bike: i.bike, fps: r(e.fps, 0), drawCalls: e.drawCalls,
    triangles: e.triangles, cam: i.camera.toArray().map((v) => v.toFixed(1)).join(','),
  };
}
