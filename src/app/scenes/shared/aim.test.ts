import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { aimAt, freeNdcX } from './aim';

describe('aimAt', () => {
  it('puts the subject at the requested screen position', () => {
    for (const [nx, ny, aspect] of [[-0.39, 0.1, 16 / 9], [0, 0, 1.5], [-0.25, -0.2, 2.1], [0.3, 0.05, 4 / 3]]) {
      const cam = new PerspectiveCamera(32, aspect, 0.1, 100);
      const eye = new Vector3(2, 1.6, 7.5);
      const subject = new Vector3(0, 0.9, 2);
      const target = aimAt(eye, subject, nx, ny, 32, aspect, 7, new Vector3());
      cam.position.copy(eye);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      const p = subject.clone().project(cam);
      expect(p.x).toBeCloseTo(nx, 5);
      expect(p.y).toBeCloseTo(ny, 5);
    }
  });
});

describe('freeNdcX', () => {
  it('centres the free space left of a right-docked panel at any viewport', () => {
    expect(freeNdcX(1280, 720, 500)).toBeCloseTo(780 / 1280 - 1, 9);
    expect(freeNdcX(1920, 1080, 500)).toBeCloseTo((1920 - 750) / 1920 - 1, 9);
    expect(freeNdcX(900, 700, 500)).toBeCloseTo((900 - 400) / 900 - 1, 9);
    expect(freeNdcX(600, 900, 500)).toBeCloseTo(-0.6, 9);
    expect(freeNdcX(1280, 720, 0)).toBe(0);
  });
});
