import { Group, type Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { isToonified, toonify } from '../env/toonify';
import { findMaterials, setColor, setEmissive } from './material-tools';
import { buildPlaceholder } from './placeholders/placeholder-registry';
import { batchStatic } from './static-batch';

const meshes = (g: Group): Mesh[] => {
  const out: Mesh[] = [];
  g.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
};

describe('static batching', () => {
  it('merges a street of identical props into one mesh per look', () => {
    const street = new Group();
    for (let i = 0; i < 20; i++) {
      const p = buildPlaceholder('prop_bougainvillea') as Group;
      p.position.set(i * 3, 0, 0);
      street.add(p);
    }
    const before = meshes(street).length;
    const looks = new Set(meshes(street).map((m) => (m.material as MeshStandardMaterial).name)).size;
    const batched = batchStatic(street);
    expect(before).toBeGreaterThan(20);
    expect(meshes(batched).length).toBe(looks);
  });

  it('keeps differently-coloured instances apart and contract names intact', () => {
    const street = new Group();
    for (const hex of ['#ff0000', '#00ff00', '#ff0000']) {
      const car = buildPlaceholder('veh_sedan') as Group;
      // per-instance materials, as Assets.instance() hands them out
      car.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) m.material = (m.material as MeshStandardMaterial).clone();
      });
      setColor(car, 'Paint', hex);
      street.add(car);
    }
    const batched = batchStatic(street);
    expect(findMaterials(batched, 'Paint').length).toBe(2);
    expect(setEmissive(batched, 'Light_Head', '#ffffff', 3)).toBe(1);
  });
});

describe('static batching: colour merge + shadow proxy', () => {
  const street = (): Group => {
    const g = new Group();
    const walls = ['#eed9b2', '#9fd3c7', '#f4e27a', '#e7c1d8', '#c9d6e8'];
    walls.forEach((hex, i) => {
      const b = buildPlaceholder('bld_shophouse_3f') as Group;
      b.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.material = (m.material as MeshStandardMaterial).clone();
        m.castShadow = true; // as Assets.store() flags every template mesh
      });
      setColor(b, 'Wall', hex);
      b.position.x = i * 4;
      g.add(b);
    });
    return g;
  };

  it('folds recoloured walls into vertex-coloured buckets but keeps runtime materials addressable', () => {
    const plain = meshes(batchStatic(street())).length;
    const merged = batchStatic(street(), { mergeColors: true });
    const list = meshes(merged);
    expect(list.length).toBeLessThan(plain);
    const vc = list.filter((m) => (m.material as MeshStandardMaterial).vertexColors);
    expect(vc.length).toBeGreaterThan(0);
    for (const m of vc) expect(m.geometry.getAttribute('color').count).toBe(m.geometry.getAttribute('position').count);
    expect(findMaterials(merged, 'Window').length).toBe(1);
    expect(findMaterials(merged, 'Sign_Face').length).toBe(1);
    expect(findMaterials(merged, 'Wall').length).toBe(0);
  });

  it('shadow proxy: batch meshes stop casting, a few cell proxies carry every caster triangle', () => {
    const batch = batchStatic(street(), { mergeColors: true, shadowProxy: true });
    const list = meshes(batch);
    const proxies = list.filter((m) => m.userData.shadowProxy === true);
    expect(proxies.length).toBeGreaterThanOrEqual(1);
    expect(proxies.length).toBeLessThanOrEqual(4);
    const fine = meshes(batchStatic(street(), { shadowProxy: true, shadowCell: 4 })).filter((m) => m.userData.shadowProxy);
    expect(fine.length).toBeGreaterThanOrEqual(5);
    for (const m of list) expect(m.castShadow).toBe(m.userData.shadowProxy === true);
    const tris = (ms: Mesh[]): number =>
      ms.reduce((n, m) => n + (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3, 0);
    expect(tris(proxies)).toBe(tris(list.filter((m) => m.userData.shadowProxy !== true)));
  });
});

describe('material tools', () => {
  it('match Blender ".001" suffixes but not prefixes of other names', () => {
    const g = new Group();
    for (const name of ['Paint', 'Paint.001', 'Paint2', 'PaintX']) {
      const m = buildPlaceholder('prop_cone') as Group;
      const mat = new MeshStandardMaterial({ name });
      m.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.isMesh) mesh.material = mat;
      });
      g.add(m);
    }
    expect(findMaterials(g, 'Paint').map((m) => m.name).sort()).toEqual(['Paint', 'Paint.001']);
  });

  it('toonify is idempotent, skips non-standard materials and survives a duplicate three copy', () => {
    const m = toonify(new MeshStandardMaterial());
    expect(isToonified(m)).toBe(true);
    const key = m.customProgramCacheKey();
    expect(toonify(m)).toBe(m);
    expect(m.customProgramCacheKey()).toBe(key);
    const foreign = Object.assign(Object.create(null) as object, { isMeshStandardMaterial: true, needsUpdate: false });
    toonify(foreign as MeshStandardMaterial);
    expect(isToonified(foreign as MeshStandardMaterial)).toBe(true);
  });
});
