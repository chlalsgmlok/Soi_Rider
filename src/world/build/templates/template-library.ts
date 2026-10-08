import type { Assets } from '../../../engine/assets/assets';
import { bakeTemplate } from './template-bake';
import type { BakedTemplate } from './template-types';

/** Baked templates by asset name (each GLB converted once per city build). */
export class TemplateLibrary {
  private readonly map = new Map<string, BakedTemplate>();

  constructor(private readonly assets: Assets) {}

  get(asset: string): BakedTemplate {
    let t = this.map.get(asset);
    if (!t) {
      const root = this.assets.shared(asset);
      t = bakeTemplate(asset, root);
      this.map.set(asset, t);
    }
    return t;
  }

  get size(): number {
    return this.map.size;
  }

  dispose(): void {
    for (const t of this.map.values()) {
      t.geometry.dispose();
      t.glass?.dispose();
      for (const g of Object.values(t.lamps)) g?.dispose();
    }
    this.map.clear();
  }
}
