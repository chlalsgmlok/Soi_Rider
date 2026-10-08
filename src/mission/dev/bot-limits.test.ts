import { describe, expect, it } from 'vitest';
import { BIKES } from '../../core/config/bikes';
import { VEHICLES } from '../../core/config/traffic';
import type { TrafficAgentView, TrafficQuery } from '../../core/types';
import { createPlayerState } from '../../player/ride-env';
import { obstacleSpeed } from './bot-limits';

/** a queued taxi at (x, z) facing +z, as the traffic module reports it */
function taxi(x: number, z: number, heading = 0): TrafficAgentView {
  const spec = VEHICLES.taxi;
  return {
    id: 1, kind: 'taxi', spec, pos: { x, z }, heading, speed: 0, obb: { cx: x, cz: z, hw: spec.width / 2, hl: spec.length / 2, angle: heading },
    mirrors: [], braking: false, indicator: 0, honking: false, paint: '#fff', paint2: '#fff', look: 0, laneId: 0, queued: true,
  };
}

function query(agents: TrafficAgentView[]): TrafficQuery {
  return {
    agents: () => agents,
    near: (_p, _r, out) => {
      out.length = 0;
      out.push(...agents);
      return agents.length;
    },
    pedestrians: () => [],
    signal: () => null,
    nudge: () => undefined,
  };
}

describe('bot obstacle corridor', () => {
  const s = createPlayerState(BIKES.cub);
  s.pos = { x: 0, z: 0 };
  s.heading = 0;
  const scratch: TrafficAgentView[] = [];

  it('slows for a car ahead in the corridor and stops short of its tail', () => {
    // tail at 12 − 2.3 m, nose 1 m ahead of the bike centre, 1.6 m stand-off at 2.6 m/s² braking
    const tail = 12 - VEHICLES.taxi.length / 2;
    expect(obstacleSpeed(s, 0, 1, query([taxi(0, 12)]), scratch, 0)).toBeCloseTo(Math.sqrt(2 * 2.6 * (tail - 1 - 1.6)), 6);
    expect(obstacleSpeed(s, 0, 1, query([taxi(0, 3.5)]), scratch, 0)).toBe(0);
  });

  it('ignores cars beside the corridor and behind the bike', () => {
    expect(obstacleSpeed(s, 0, 1, query([taxi(1.6, 6)]), scratch, 0)).toBe(Infinity);
    expect(obstacleSpeed(s, 0, 1, query([taxi(0, -6)]), scratch, 0)).toBe(Infinity);
  });

  it('a filtering offset opens the corridor beside a queued car', () => {
    expect(obstacleSpeed(s, 0, 1, query([taxi(0, 5)]), scratch, 1.7)).toBe(Infinity);
  });

  it('lets the bike creep around the corner of a car until it is close', () => {
    // car tail-corner 1.4 m ahead, bike pivoted 45° to the right of it: the corner is clear of the band
    const turned = Math.SQRT1_2;
    const v = obstacleSpeed(s, -turned, turned, query([taxi(0, 3.7)]), scratch, 0);
    expect(v).toBeGreaterThan(0);
  });
});
