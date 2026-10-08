/** A placed cell in pixels (top-left origin). */
export interface PackedCell {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Shelf {
  y: number;
  h: number;
  x: number;
}

/**
 * Shelf packer for the sign atlas, first-fit by height: a cell goes on the first open shelf of (nearly) its height
 * that still has room, otherwise a new shelf opens below — so tall menus and slim fascia signs never share a row.
 * Returns null when the atlas is full.
 */
export class ShelfPacker {
  private readonly shelves: Shelf[] = [];
  private nextY = 0;

  constructor(readonly width: number, readonly height: number, readonly pad = 4) {}

  add(w: number, h: number): PackedCell | null {
    const pw = Math.min(this.width - 2 * this.pad, Math.ceil(w));
    const ph = Math.ceil(h);
    const span = pw + 2 * this.pad;
    let shelf = this.shelves.find((s) => s.h >= ph && s.h <= ph * 1.2 + 2 && s.x + span <= this.width);
    if (!shelf) {
      if (this.nextY + ph + 2 * this.pad > this.height) return null;
      shelf = { y: this.nextY, h: ph, x: 0 };
      this.shelves.push(shelf);
      this.nextY += ph + 2 * this.pad;
    }
    const cell = { x: shelf.x + this.pad, y: shelf.y + this.pad, w: pw, h: ph };
    shelf.x += span;
    return cell;
  }

  /** the same packing state on a taller atlas (rows already placed stay where they are) */
  resized(height: number): ShelfPacker {
    const p = new ShelfPacker(this.width, height, this.pad);
    p.shelves.push(...this.shelves.map((s) => ({ ...s })));
    p.nextY = this.nextY;
    return p;
  }

  /** fraction of the atlas height opened so far */
  get fill(): number {
    return Math.min(1, this.nextY / this.height);
  }
}
