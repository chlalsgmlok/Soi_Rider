import { type BufferGeometry, CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import type { UvRect } from '../markings/markings-atlas';
import { type PackedCell, ShelfPacker } from './shelf-packer';
import type { SignPainter } from './sign-paint-kit';

const WIDTH = 2048;
const HEIGHTS = [1024, 2048, 3072, 4096];

/**
 * Per-city CanvasTexture atlas of sign artwork. Cells are deduplicated by key (same words + design → one cell) and
 * the canvas grows (1024 → 4096 px tall) as a district needs more artwork. Rects are handed out in PIXELS
 * ([x0, yBottom, x1, yTop], y down) and `normalize()` converts finished geometry UVs once the size is final.
 */
export class SignAtlas {
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private packer: ShelfPacker;
  private level = 0;
  private readonly cells = new Map<string, { rect: UvRect; cell: PackedCell; paint: SignPainter }>();
  private readonly fallback = new Map<string, UvRect>();
  /** requests that found the atlas full even at its largest (they reuse a fallback cell) */
  misses = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHTS[0];
    this.g = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.packer = new ShelfPacker(WIDTH, HEIGHTS[0], 4);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.name = 'city_sign_atlas';
  }

  get count(): number {
    return this.cells.size;
  }

  /** used fraction of the (current) atlas */
  get fill(): number {
    return this.packer.fill;
  }

  get height(): number {
    return this.canvas.height;
  }

  /** pixel rect for a design; `kind` groups fallbacks (e.g. 'shop', 'menu') if the atlas is ever exhausted */
  cell(key: string, kind: string, w: number, h: number, paint: SignPainter): UvRect {
    const known = this.cells.get(key);
    if (known) return known.rect;
    let cell = this.packer.add(w, h);
    while (!cell && this.grow()) cell = this.packer.add(w, h);
    if (!cell) {
      this.misses++;
      return this.fallback.get(kind) ?? [0, 0, 1, 1];
    }
    this.draw(cell, paint);
    const rect: UvRect = [cell.x + 0.5, cell.y + cell.h - 0.5, cell.x + cell.w - 0.5, cell.y + 0.5];
    this.cells.set(key, { rect, cell, paint });
    if (!this.fallback.has(kind)) this.fallback.set(kind, rect);
    return rect;
  }

  /** pixel UVs → texture UVs (call on every geometry built from this atlas once all cells exist) */
  normalize(g: BufferGeometry): void {
    const uv = g.getAttribute('uv');
    if (!uv) return;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / WIDTH, 1 - uv.getY(i) / this.canvas.height);
    uv.needsUpdate = true;
  }

  /** redraw every cell (after the sign fonts have loaded) */
  repaint(): void {
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const { cell, paint } of this.cells.values()) this.draw(cell, paint);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }

  /** taller canvas keeping every drawn cell where it is */
  private grow(): boolean {
    if (this.level + 1 >= HEIGHTS.length) return false;
    this.level++;
    const old = this.canvas;
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHTS[this.level];
    this.g = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.g.drawImage(old, 0, 0);
    this.packer = this.packer.resized(HEIGHTS[this.level]);
    this.texture.image = this.canvas;
    this.texture.needsUpdate = true;
    return true;
  }

  private draw(c: PackedCell, paint: SignPainter): void {
    const g = this.g;
    g.save();
    g.translate(c.x, c.y);
    g.beginPath();
    g.rect(0, 0, c.w, c.h);
    g.clip();
    g.clearRect(0, 0, c.w, c.h);
    paint(g, c.w, c.h);
    g.restore();
    this.texture.needsUpdate = true;
  }
}
