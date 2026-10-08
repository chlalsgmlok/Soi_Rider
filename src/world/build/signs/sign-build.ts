import { type BatchedMesh, type Matrix4, Vector3 } from 'three';
import type { CityData, Placement } from '../../../core/types';
import { DISTRICTS } from '../../districts';
import { preloadCityFonts } from '../asset-list';
import { buildBatch, worldItem } from '../kit/batch';
import { ChunkSet } from '../kit/chunk-set';
import type { TemplateLibrary } from '../templates/template-library';
import { SignAtlas } from './sign-atlas';
import {
  cartSpec, GLOW, menuSpec, type SignContext, type SignLayer, type SignSpec, specForPart, verticalSpec, WHOLE,
} from './sign-content';
import { emitAFrame, emitBlade, emitLocalQuad, emitPart, emitRegion } from './sign-geometry';
import type { SignPart } from '../templates/template-types';
import type { MeshBuilder } from '../kit/mesh-builder';
import { SignMaterial } from './sign-material';
import { buildTemplePlaques } from './sign-plaques';

/** where a lit sign throws coloured light on the pavement at night */
export interface SignGlow {
  x: number;
  z: number;
  color: string;
  strength: number;
}

export interface Signs {
  mesh: BatchedMesh | null;
  count: number;
  /** unique artworks in the atlas, atlas fill 0..1, requests that did not fit */
  atlas: { cells: number; height: number; fill: number; misses: number };
  glows: SignGlow[];
  setLamps(lamps: number): void;
  dispose(): void;
}

const v = new Vector3();

function stationNames(data: CityData): SignContext['station'] {
  const st = data.placements.find((p) => p.asset === 'bts_station');
  const pois = data.pois.filter((p) => p.kind === 'bts');
  const near = st ? pois.sort((a, b) => Math.hypot(a.pos.x - st.pos.x, a.pos.z - st.pos.z) - Math.hypot(b.pos.x - st.pos.x, b.pos.z - st.pos.z))[0] : pois[0];
  const def = DISTRICTS[data.district].station;
  return { th: near?.nameTh ?? def.th, ko: near?.name ?? def.name };
}

/**
 * Every sign of the city — shop fascias (Thai / English / Korean, lightbox or neon), Yaowarat's vertical red-gold
 * boards, chalkboard menus, cart headers, soi plates, win-stand crests, bus plates, the mall screen, the station name —
 * drawn into one CanvasTexture atlas and batched into chunked quads (one draw call).
 */
export function buildSigns(data: CityData, matrices: readonly Matrix4[], templates: TemplateLibrary): Signs {
  const atlas = new SignAtlas();
  const material = new SignMaterial(atlas.texture);
  const chunks = new ChunkSet();
  const ctx: SignContext = { def: DISTRICTS[data.district], station: stationNames(data) };
  const blank = atlas.cell('blank', 'blank', 8, 8, () => undefined);
  const glows: SignGlow[] = [];
  let count = 0;
  const cell = (L: SignLayer) => atlas.cell(L.key, L.kind, L.px[0], L.px[1], L.paint);
  const emitSpec = (mb: MeshBuilder, part: SignPart, m: Matrix4, s: SignSpec): void => {
    if (s.layers.length === 1 && s.layers[0].region === WHOLE) {
      emitPart(mb, part, m, cell(s.layers[0]), s.board, s.glow);
      return;
    }
    s.layers.forEach((L, k) => emitRegion(mb, part, m, L.region, cell(L), s.board, s.glow, 0.012 + k * 0.004));
  };
  const glowAt = (p: Placement, m: Matrix4, s: SignSpec, ahead: number): void => {
    if (s.glow === GLOW.plate) return;
    v.set(0, 0, ahead).applyMatrix4(m);
    glows.push({ x: v.x, z: v.z, color: s.glow === GLOW.neon ? (p.meta?.sign ?? '#ff4fa3') : s.board, strength: s.glow === GLOW.neon ? 0.5 : 0.32 });
  };
  data.placements.forEach((p, i) => {
    const m = matrices[i];
    const mb = chunks.at(p.pos.x, p.pos.z);
    for (const part of templates.get(p.asset).signs) {
      if (part.node === 'countdown') continue;
      const s = specForPart(p, ctx);
      if (!s) continue;
      emitSpec(mb, part, m, s);
      if (p.asset.startsWith('bld_shophouse')) glowAt(p, m, s, 1.9);
      count++;
    }
    if (p.asset.startsWith('bld_shophouse')) {
      const side = p.variant & 1 ? 1 : -1;
      const vs = verticalSpec(p, ctx);
      if (vs) {
        emitBlade(mb, m, side * 1.62, 4.25, 6.85, 0.3, 1.25, cell(vs.layers[0]), blank, vs.board, vs.glow);
        count++;
      }
      const ms = menuSpec(p, ctx);
      if (ms) {
        emitAFrame(mb, m, -side * 1.05, 0.72, cell(ms.layers[0]), ms.glow);
        count++;
      }
    } else if (p.asset === 'prop_food_cart') {
      const cs = cartSpec(p);
      if (cs) {
        emitLocalQuad(mb, m, [[-0.72, 1.55, 0.38], [0.32, 1.55, 0.38], [0.32, 1.83, 0.38], [-0.72, 1.83, 0.38]], [0, 0, 1], cell(cs.layers[0]), cs.board, cs.glow);
        count++;
      }
    }
  });
  count += buildTemplePlaques(data, chunks, (key, w, h, paint) => atlas.cell(key, 'plaque', w, h, paint));
  const geos = chunks.builders().map((b) => b.toGeometry('sign'));
  for (const g of geos) atlas.normalize(g);
  const batch = buildBatch('city_signs', geos.map(worldItem), material.material, { receiveShadow: true });
  if (typeof document !== 'undefined' && document.fonts && !document.fonts.check('700 32px Kanit')) {
    void preloadCityFonts().then(() => atlas.repaint());
  }
  return {
    mesh: batch?.mesh ?? null,
    count,
    atlas: { cells: atlas.count, height: atlas.height, fill: Math.round(atlas.fill * 100) / 100, misses: atlas.misses },
    glows,
    setLamps: (l) => material.setLamps(l),
    dispose(): void {
      batch?.mesh.dispose();
      material.dispose();
      atlas.dispose();
    },
  };
}
