import type { Material, Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonify } from '../env/toonify';
import { loadGlb, MODEL_BASE } from './glb-source';
import { forEachMaterial } from './material-tools';
import { buildPlaceholder } from './placeholders/placeholder-registry';

export type AssetSource = 'glb' | 'placeholder';
export type AssetProgress = (done: number, total: number, name: string, source: AssetSource | 'missing') => void;

export interface AssetsOptions {
  /** URL folder holding <name>.glb (default: <base>assets/models/) */
  baseUrl?: string;
  /** parallel downloads */
  concurrency?: number;
}

interface Template {
  root: Object3D;
  source: AssetSource;
}

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true;

/**
 * GLB cache. `preload` fetches models (falling back to contract-faithful placeholders when a GLB is missing),
 * applies toon shading + shadow flags once per template, then hands out clones:
 *  - `instance(name)` deep clone with its OWN materials (recolour freely; `release()` when discarded)
 *  - `shared(name)`   clone sharing geometry + materials (cheapest; recolouring affects all shared clones)
 */
export class Assets {
  private readonly loader = new GLTFLoader();
  private readonly templates = new Map<string, Template>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly templateMaterials = new WeakSet<Material>();
  private readonly baseUrl: string;
  private readonly concurrency: number;

  constructor(opts: AssetsOptions = {}) {
    this.baseUrl = opts.baseUrl ?? MODEL_BASE;
    this.concurrency = Math.max(1, opts.concurrency ?? 6);
  }

  async preload(names: readonly string[], onProgress?: AssetProgress): Promise<void> {
    const queue = [...new Set(names)];
    const total = queue.length;
    let done = 0;
    const worker = async (): Promise<void> => {
      for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
        await this.load(name);
        done++;
        onProgress?.(done, total, name, this.templates.get(name)?.source ?? 'missing');
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, total) }, worker));
  }

  /** loaded (as GLB or placeholder) */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  source(name: string): AssetSource | null {
    return this.templates.get(name)?.source ?? null;
  }

  /** names currently served by placeholders */
  placeholders(): string[] {
    return [...this.templates].filter(([, t]) => t.source === 'placeholder').map(([n]) => n);
  }

  /** deep clone with per-instance materials (toonified) */
  instance(name: string): Object3D {
    const copy = this.template(name).clone(true);
    const map = new Map<Material, Material>();
    const own = (m: Material): Material => {
      let c = map.get(m);
      if (!c) {
        c = toonify(m.clone());
        map.set(m, c);
      }
      return c;
    };
    copy.traverse((o) => {
      if (isMesh(o)) o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    });
    return copy;
  }

  /** clone sharing geometry and materials with the template */
  shared(name: string): Object3D {
    return this.template(name).clone(true);
  }

  /** dispose the per-instance materials of an `instance()` clone (geometry stays cached) */
  release(root: Object3D): void {
    forEachMaterial(root, (m) => {
      if (!this.templateMaterials.has(m)) m.dispose();
    });
    root.removeFromParent();
  }

  dispose(): void {
    for (const t of this.templates.values()) {
      t.root.traverse((o) => {
        if (isMesh(o)) o.geometry.dispose();
      });
      forEachMaterial(t.root, (m) => m.dispose());
    }
    this.templates.clear();
    this.pending.clear();
  }

  private template(name: string): Object3D {
    const t = this.templates.get(name);
    if (t) return t.root;
    const ph = buildPlaceholder(name);
    if (!ph) throw new Error(`[assets] unknown asset "${name}"`);
    console.warn(`[assets] "${name}" used before preload — serving its placeholder`);
    this.store(name, ph, 'placeholder');
    return ph;
  }

  private load(name: string): Promise<void> {
    if (this.templates.has(name)) return Promise.resolve();
    let p = this.pending.get(name);
    if (!p) {
      p = loadGlb(this.loader, this.baseUrl, name).then((glb) => {
        if (glb) this.store(name, glb, 'glb');
        else {
          const ph = buildPlaceholder(name);
          if (ph) this.store(name, ph, 'placeholder');
          else console.warn(`[assets] "${name}" has no GLB and no placeholder`);
        }
        this.pending.delete(name);
      });
      this.pending.set(name, p);
    }
    return p;
  }

  private store(name: string, root: Object3D, source: AssetSource): void {
    root.name = name;
    root.traverse((o) => {
      if (!isMesh(o)) return;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    forEachMaterial(root, (m) => {
      toonify(m);
      this.templateMaterials.add(m);
    });
    root.updateMatrixWorld(true);
    this.templates.set(name, { root, source });
  }
}
