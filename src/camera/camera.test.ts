import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BIKES } from '../core/config/bikes';
import { CAMERA } from '../core/config/camera';
import { Surface } from '../core/types';
import { BikePhysics } from '../player/bike-physics';
import { AutoSqueeze } from './auto-squeeze';
import { CameraClip } from './camera-clip';
import { CameraRig } from './camera-rig';
import { CameraShake } from './camera-shake';

const DT = 1 / 60;
const run = (a: AutoSqueeze, seconds: number, gap: number, kmh: number): number => {
  for (let i = 0; i < Math.round(seconds / DT); i++) a.update(DT, gap, kmh, false);
  return a.level;
};

describe('AutoSqueeze (diorama ⇄ squeeze)', () => {
  it('blends in over 0.6 s when a gap < 45 cm appears below 22 km/h', () => {
    const a = new AutoSqueeze();
    expect(run(a, 0.3, 0.3, 12)).toBeCloseTo(0.5, 1);
    expect(run(a, 0.31, 0.3, 12)).toBe(1);
    expect(a.active).toBe(true);
  });

  it('ignores tight gaps at speed and open gaps when slow', () => {
    const a = new AutoSqueeze();
    expect(run(a, 1, 0.3, 30)).toBe(0);
    expect(run(a, 1, 0.8, 10)).toBe(0);
  });

  it('holds 1.2 s after the squeeze, then blends out over 1.0 s', () => {
    const a = new AutoSqueeze();
    run(a, 1, 0.2, 12);
    expect(run(a, 1.1, 1.5, 12)).toBe(1); // still holding
    expect(run(a, 0.6, 1.5, 12)).toBeCloseTo(0.5, 1); // 0.1 s hold left + 0.5 s out
    expect(run(a, 0.6, 1.5, 12)).toBe(0);
  });

  it('has hysteresis: a gap hovering between 45 and 62 cm keeps the squeeze', () => {
    const a = new AutoSqueeze();
    run(a, 1, 0.4, 12);
    expect(run(a, 3, 0.55, 12)).toBe(1);
    expect(run(a, 3, 0.55, 24)).toBe(1); // 22 < 24 < 26 km/h
  });
});

describe('CameraClip', () => {
  it('pulls the boom in front of a building between the bike and the camera and lifts it', () => {
    const clip = new CameraClip();
    const world = { surfaceAt: (x: number) => (x > 5 ? Surface.Building : Surface.Road) };
    const pivot = new Vector3(0, 1, 0);
    let pos = new Vector3();
    for (let i = 0; i < 120; i++) {
      pos = new Vector3(10, 4, 0);
      clip.apply(DT, world, pivot, pos);
    }
    expect(pos.x).toBeLessThan(5);
    expect(pos.y).toBeGreaterThan(4);
    const free = new Vector3(-10, 4, 0);
    new CameraClip().apply(DT, world, pivot, free);
    expect(free.x).toBe(-10);
  });
});

describe('CameraShake', () => {
  it('decays to rest within its duration and is silent with reduced motion', () => {
    const s = new CameraShake();
    const o = new Vector3();
    s.add(1, 0.5);
    s.update(0.05, o);
    expect(o.length()).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) s.update(DT, o);
    expect(o.length()).toBe(0);
    s.enabled = false;
    s.add(1, 1);
    s.update(DT, o);
    expect(o.length()).toBe(0);
  });
});

describe('CameraRig', () => {
  const bike = new BikePhysics(BIKES.scooter);
  bike.teleport({ x: 0, z: 0 }, 0);
  const open = { left: Infinity, right: Infinity, leftPoint: null, rightPoint: null, leftId: -1, rightId: -1 };

  it('diorama frames from behind, high, with the tilt-shift band on the bike in the lower half', () => {
    const cam = new PerspectiveCamera(36, 16 / 9, 0.1, 900);
    const rig = new CameraRig(cam);
    rig.setMode('diorama');
    const post = rig.update(DT, bike.state, open);
    expect(cam.position.y).toBeCloseTo(CAMERA.diorama.up, 0);
    expect(cam.position.z).toBeLessThan(-8);
    expect(post.tiltShift).toBe(CAMERA.diorama.tiltShift);
    expect(post.focusY).toBeGreaterThan(0.2);
    expect(post.focusY).toBeLessThan(0.5);
  });

  it('pov sits at eye height with no tilt-shift and cycles back to auto', () => {
    const cam = new PerspectiveCamera(36, 16 / 9, 0.1, 900);
    const rig = new CameraRig(cam);
    rig.setMode('pov');
    const post = rig.update(DT, bike.state, open);
    expect(cam.position.y).toBeCloseTo(CAMERA.pov.eyeUp, 1);
    expect(cam.fov).toBe(CAMERA.pov.fov);
    expect(post.tiltShift).toBe(0);
    expect(rig.povActive).toBe(true);
    expect(rig.cycleMode()).toBe('auto');
  });
});
