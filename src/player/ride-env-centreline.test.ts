import { describe, expect, it } from 'vitest';
import { BIKES } from '../core/config/bikes';
import { SCORE } from '../core/config/scoring';
import { type Lane, type LaneHit, type RoadEdge, Surface, type Vec2 } from '../core/types';
import { createPlayerState, FLAT_ENV, laneStatus, type RideEnv } from './ride-env';

const LANE_W = 3.5;

/** a two-lane road along Z (Thailand keeps LEFT, +X = left of +Z): lane 0 runs +Z, lane 1 runs −Z; the yellow line / median is at x 0 */
function road(median: number, oneWay = false): RideEnv {
  const off = median / 2 + LANE_W / 2;
  const lane = (id: number, x: number, dirZ: 1 | -1): Lane => ({
    id, edge: 7, forward: dirZ > 0, index: 0, start: { x, z: -100 * dirZ }, end: { x, z: 100 * dirZ },
    dir: { x: 0, z: dirZ }, length: 200, width: LANE_W, offset: x, speedLimit: 14, out: [], in: [],
  });
  const lanes = [lane(0, off, 1), lane(1, -off, -1)];
  const nearestLane = (p: Vec2): LaneHit | null => {
    let best: LaneHit | null = null;
    for (const l of lanes) {
      const dist = Math.abs(p.x - l.offset);
      if (dist > 6 || (best && best.dist <= dist)) continue;
      best = { lane: l, s: (p.z - l.start.z) * l.dir.z, lateral: (p.x - l.offset) * l.dir.z, dist };
    }
    return best;
  };
  const edge: RoadEdge = {
    id: 7, a: 0, b: 1, cls: 'soi', oneWay, lanesAB: 1, lanesBA: 1, laneWidth: LANE_W, median, sidewalk: 2,
    skytrain: false, length: 200, dir: { x: 0, z: 1 }, name: 'Soi 7', nameTh: 'ซอย 7',
  };
  return { ...FLAT_ENV, surfaceAt: () => Surface.Road, nearestLane, edge: () => edge };
}

/** riding north (+Z) at x: x < 0 is the oncoming lane */
function ride(x: number, env: RideEnv, heading = 0): ReturnType<typeof createPlayerState> {
  const s = createPlayerState(BIKES.cub);
  s.pos = { x, z: 0 };
  s.heading = heading;
  s.speed = 8;
  s.surface = Surface.Road;
  laneStatus(s, env);
  return s;
}

describe('counterflow grace along the yellow centre line', () => {
  it(`hugging the centre line (≤ ${SCORE.counterflowGraceM} m) in the oncoming lane is not penalised`, () => {
    const env = road(0);
    expect(ride(-0.4, env)).toMatchObject({ laneId: 1, counterflow: false, centerline: true });
    expect(ride(-SCORE.counterflowGraceM, env)).toMatchObject({ counterflow: false, centerline: true });
  });

  it('beyond the grace band the oncoming lane is counterflow again', () => {
    const env = road(0);
    expect(ride(-SCORE.counterflowGraceM - 0.2, env)).toMatchObject({ laneId: 1, counterflow: true, centerline: false });
    expect(ride(-1.75, env)).toMatchObject({ counterflow: true, centerline: false });
  });

  it('riding with the traffic never shows the centre-line chip', () => {
    const env = road(0);
    expect(ride(0.4, env)).toMatchObject({ laneId: 0, counterflow: false, centerline: false });
    // turned round right by the line in the own lane: against lane 0, but hugging the line
    expect(ride(0.4, env, Math.PI)).toMatchObject({ laneId: 0, counterflow: false, centerline: true });
  });

  it('the band starts at the median edge, not at the road centre', () => {
    const env = road(2); // median kerb at x −1
    expect(ride(-1.6, env)).toMatchObject({ laneId: 1, counterflow: false, centerline: true });
    expect(ride(-2.3, env)).toMatchObject({ counterflow: true, centerline: false });
  });

  it('one-way streets have no centre line: every wrong-way metre counts', () => {
    const env = road(0, true);
    expect(ride(-0.4, env)).toMatchObject({ counterflow: true, centerline: false });
  });

  it('without edge data (older envs) the old rule applies', () => {
    const env: RideEnv = { ...road(0), edge: undefined };
    expect(ride(-0.4, env)).toMatchObject({ counterflow: true, centerline: false });
  });
});
