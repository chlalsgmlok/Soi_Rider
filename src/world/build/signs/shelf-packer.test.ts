import { describe, expect, it } from 'vitest';
import { type PackedCell, ShelfPacker } from './shelf-packer';

const overlaps = (a: PackedCell, b: PackedCell): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('sign atlas shelf packer', () => {
  it('packs cells inside the atlas without overlaps', () => {
    const p = new ShelfPacker(512, 512, 2);
    const cells: PackedCell[] = [];
    for (let i = 0; i < 40; i++) {
      const c = p.add(40 + (i % 5) * 30, [20, 40, 60][i % 3]);
      if (c) cells.push(c);
    }
    expect(cells.length).toBeGreaterThan(20);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(512);
      expect(c.y + c.h).toBeLessThanOrEqual(512);
    }
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) expect(overlaps(cells[i], cells[j])).toBe(false);
  });

  it('keeps slim and tall cells on separate shelves', () => {
    const p = new ShelfPacker(1024, 1024, 0);
    const slim = p.add(100, 20);
    const tall = p.add(100, 160);
    const slim2 = p.add(100, 20);
    expect(slim && tall && slim2).toBeTruthy();
    expect(slim2?.y).toBe(slim?.y);
    expect(tall?.y).not.toBe(slim?.y);
  });

  it('reports full, and a resized packer continues below the existing rows', () => {
    const p = new ShelfPacker(100, 100, 0);
    expect(p.add(100, 60)).not.toBeNull();
    expect(p.add(100, 60)).toBeNull();
    const big = p.resized(200);
    const c = big.add(100, 60);
    expect(c?.y).toBe(60);
    expect(big.fill).toBeCloseTo(0.6);
  });
});
