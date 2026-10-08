import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Surface } from '../core/types';
import { CameraClip, type CameraWorld } from './camera-clip';

const open: CameraWorld = { surfaceAt: () => Surface.Road, roofAt: () => 0 };
/** a BTS deck (underside 9.3 m) over everything with x > 0 */
const deck: CameraWorld = { ...open, ceilingAt: (x) => (x > 0 ? 9.3 : 0) };

function settle(clip: CameraClip, world: CameraWorld, pivot: Vector3, cam: Vector3, seconds: number): Vector3 {
  const pos = cam.clone();
  for (let t = 0; t < seconds; t += 1 / 60) {
    pos.copy(cam);
    clip.apply(1 / 60, world, pivot, pos);
  }
  return pos;
}

describe('CameraClip under the skytrain deck', () => {
  it('leaves a camera over open street alone', () => {
    const pos = settle(new CameraClip(), open, new Vector3(5, 1.2, 0), new Vector3(5, 10.5, -13.5), 1);
    expect(pos.y).toBeCloseTo(10.5, 5);
  });

  it('eases the diorama camera below the deck underside when the rider is under the viaduct', () => {
    const clip = new CameraClip();
    const pivot = new Vector3(5, 1.2, 0);
    const cam = new Vector3(5, 10.5, -13.5);
    const early = settle(clip, deck, pivot, cam, 1 / 30);
    expect(early.y).toBeGreaterThan(8.6); // eased, not snapped
    const later = settle(clip, deck, pivot, cam, 1.5);
    expect(later.y).toBeLessThanOrEqual(9.3 - 1.2 + 0.05);
    expect(later.y).toBeGreaterThan(pivot.y + 1.4);
  });

  it('rises back to the normal height after leaving the deck', () => {
    const clip = new CameraClip();
    settle(clip, deck, new Vector3(5, 1.2, 0), new Vector3(5, 10.5, -13.5), 1.5);
    const out = settle(clip, deck, new Vector3(-20, 1.2, 0), new Vector3(-20, 10.5, -13.5), 4);
    expect(out.y).toBeCloseTo(10.5, 1);
  });
});
