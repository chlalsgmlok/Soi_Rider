import { describe, expect, it } from 'vitest';
import type { OBB } from '../core/types';
import { newGapPoints, obbCircleGap, obbGap } from './obb-gap';
import { obbCircleOverlap, obbOverlap } from './sat';
import { SpatialHash } from './spatial-hash';

const box = (cx: number, cz: number, hw: number, hl: number, angle = 0): OBB => ({ cx, cz, hw, hl, angle });

describe('obbOverlap (SAT)', () => {
  it('finds the least-overlap axis with a normal pointing from B to A', () => {
    const p = obbOverlap(box(0, 0, 1, 2), box(1.8, 0, 1, 2));
    expect(p).not.toBeNull();
    expect(p?.depth).toBeCloseTo(0.2, 9);
    expect(p?.normal.x).toBeCloseTo(-1, 9);
    expect(p?.normal.z).toBeCloseTo(0, 9);
  });

  it('separates along the long axis when that overlap is smaller', () => {
    const p = obbOverlap(box(0, 0, 1, 2), box(0.5, 3.9, 1, 2));
    expect(p?.depth).toBeCloseTo(0.1, 9);
    expect(p?.normal.z).toBeCloseTo(-1, 9);
  });

  it('rejects a rotated box that only overlaps the bounding boxes', () => {
    // diamond (45°) whose corner points at A but stops 0.05 m short of A's face
    const d = box(1 + Math.SQRT2 + 0.05, 0, 1, 1, Math.PI / 4);
    expect(obbOverlap(box(0, 0, 1, 1), d)).toBeNull();
  });

  it('treats exact touching as separated', () => {
    expect(obbOverlap(box(0, 0, 1, 1), box(2, 0, 1, 1))).toBeNull();
  });
});

describe('obbGap', () => {
  it('measures parallel boxes face to face with the closest points', () => {
    const g = newGapPoints();
    const d = obbGap(box(0, 0, 0.5, 1), box(2, 0.5, 0.5, 1), g);
    expect(d).toBeCloseTo(1, 9);
    expect(g.onA.x).toBeCloseTo(0.5, 9);
    expect(g.onB.x).toBeCloseTo(1.5, 9);
  });

  it('measures a 45° corner against a face exactly', () => {
    const g = newGapPoints();
    const d = obbGap(box(0, 0, 1, 1), box(3, 0, 1, 1, Math.PI / 4), g);
    expect(d).toBeCloseTo(3 - Math.SQRT2 - 1, 9);
    expect(g.onA.x).toBeCloseTo(1, 9);
    expect(g.onA.z).toBeCloseTo(0, 9);
    expect(g.onB.x).toBeCloseTo(3 - Math.SQRT2, 9);
  });

  it('is zero for overlapping boxes', () => {
    expect(obbGap(box(0, 0, 1, 1), box(1.5, 0.3, 1, 1, 0.4))).toBe(0);
  });

  it('measures corner to corner diagonally', () => {
    expect(obbGap(box(0, 0, 1, 1), box(3, 3, 1, 1))).toBeCloseTo(Math.SQRT2, 9);
  });
});

describe('box vs circle', () => {
  it('gap and overlap from outside', () => {
    expect(obbCircleGap(box(0, 0, 1, 1), { cx: 3, cz: 0, r: 0.5 })).toBeCloseTo(1.5, 9);
    const p = obbCircleOverlap(box(0, 0, 1, 1), { cx: 1.2, cz: 0, r: 0.5 });
    expect(p?.depth).toBeCloseTo(0.3, 9);
    expect(p?.normal.x).toBeCloseTo(-1, 9);
  });

  it('pushes the box out through the nearest face when the centre is inside', () => {
    const p = obbCircleOverlap(box(0, 0, 1, 2), { cx: 0.8, cz: 0, r: 0.1 });
    expect(p?.depth).toBeCloseTo(0.3, 9);
    expect(p?.normal.x).toBeCloseTo(-1, 9);
  });

  it('separates a circle that only touches the bounding square near a corner', () => {
    expect(obbCircleOverlap(box(0, 0, 1, 1), { cx: 1.4, cz: 1.4, r: 0.5 })).toBeNull();
  });
});

describe('SpatialHash', () => {
  it('returns each item once and only items in touched cells', () => {
    const h = new SpatialHash<string>(2);
    h.insert('wide', -3, -1, 3, 1);
    h.insertCircle('a', 0.5, 0.5, 0.2);
    h.insertCircle('far', 40, 40, 1);
    const out: string[] = [];
    expect(h.query(-1, -1, 1, 1, out)).toBe(2);
    expect(out.sort()).toEqual(['a', 'wide']);
    expect(h.queryCircle(40, 40, 0.5, out)).toBe(1);
    expect(out).toEqual(['far']);
    h.clear();
    expect(h.query(-100, -100, 100, 100, out)).toBe(0);
  });

  it('handles negative coordinates and reuses buckets after clear', () => {
    const h = new SpatialHash<number>(4);
    for (let i = 0; i < 50; i++) h.insertCircle(i, -100 + i * 4, -50, 0.5);
    const out: number[] = [];
    expect(h.query(-101, -51, -97, -49, out)).toBe(2); // cells x ∈ [−104, −96): items at −100 and −96 (r 0.5)
    h.clear();
    h.insertCircle(7, -10, -10, 0.1);
    expect(h.query(-12, -12, -8, -8, out)).toBe(1);
  });
});
