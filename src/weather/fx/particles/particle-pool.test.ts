import { describe, expect, it } from 'vitest';
import { createSpec, ParticlePool } from './particle-pool';

const spawn = (pool: ParticlePool, over: Partial<ReturnType<typeof createSpec>> = {}): boolean =>
  pool.emit({ ...createSpec(), ...over });

describe('ParticlePool', () => {
  it('integrates velocity and gravity, settles on its floor and retires at the end of life', () => {
    const pool = new ParticlePool(8);
    spawn(pool, { y: 1, vx: 2, vy: 0, life: 1, drag: 0, gravity: -9.8, floor: 0.1 });
    for (let i = 0; i < 30; i++) pool.step(1 / 60, 0, 0);
    expect(pool.f.x[0]).toBeCloseTo(1, 5);
    expect(pool.f.y[0]).toBeLessThan(1);
    for (let i = 0; i < 25; i++) pool.step(1 / 60, 0, 0);
    expect(pool.f.y[0]).toBeCloseTo(0.1, 5);
    expect(pool.f.vy[0]).toBe(0);
    for (let i = 0; i < 10; i++) pool.step(1 / 60, 0, 0);
    expect(pool.count).toBe(0);
  });

  it('drags particles toward the wind velocity', () => {
    const pool = new ParticlePool(2);
    spawn(pool, { life: 10, drag: 2 });
    for (let i = 0; i < 240; i++) pool.step(1 / 60, 3, -1);
    expect(pool.f.vx[0]).toBeCloseTo(3, 1);
    expect(pool.f.vz[0]).toBeCloseTo(-1, 1);
  });

  it('keeps live particles packed when others die, and respects its budget', () => {
    const pool = new ParticlePool(4);
    expect(spawn(pool, { life: 0.1, x: 1 })).toBe(true);
    expect(spawn(pool, { life: 5, x: 2 })).toBe(true);
    expect(spawn(pool, { life: 0.1, x: 3 })).toBe(true);
    expect(spawn(pool, { life: 5, x: 4 })).toBe(true);
    expect(spawn(pool, { life: 5, x: 5 })).toBe(false);
    pool.step(0.2, 0, 0);
    expect(pool.count).toBe(2);
    expect([pool.f.x[0], pool.f.x[1]].sort()).toEqual([2, 4]);
    pool.limit = 2;
    expect(spawn(pool, { life: 5 })).toBe(false);
    expect(spawn(pool, { life: 0 })).toBe(false);
  });

  it('reports the life fraction', () => {
    const pool = new ParticlePool(1);
    spawn(pool, { life: 2 });
    pool.step(0.5, 0, 0);
    expect(pool.t(0)).toBeCloseTo(0.25, 5);
  });
});
