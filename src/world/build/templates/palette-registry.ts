import { Color } from 'three';
import { PALETTE_SIZE } from './city-material';

const a = new Color();
const b = new Color();

/**
 * Unique tint colours of a city → small integer indices (the uber shader reads uCityPalette[index]).
 * Index 0 means "keep the authored colour". When the table is full the nearest registered colour is reused.
 */
export class PaletteRegistry {
  private readonly map = new Map<string, number>();
  readonly hexes: string[] = ['#ffffff'];

  index(hex: string | undefined): number {
    if (!hex) return 0;
    const key = hex.toLowerCase();
    const known = this.map.get(key);
    if (known !== undefined) return known;
    if (this.hexes.length < PALETTE_SIZE) {
      this.hexes.push(key);
      this.map.set(key, this.hexes.length - 1);
      return this.hexes.length - 1;
    }
    return this.nearest(key);
  }

  private nearest(hex: string): number {
    a.set(hex);
    let best = 1;
    let bestD = Infinity;
    for (let i = 1; i < this.hexes.length; i++) {
      b.set(this.hexes[i]);
      const d = (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
      if (d < bestD) [best, bestD] = [i, d];
    }
    return best;
  }
}
