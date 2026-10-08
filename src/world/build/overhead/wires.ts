import { type Matrix4, Vector3 } from 'three';
import type { Rng } from '../../../core/rng';
import type { CityData, Placement } from '../../../core/types';
import { Surface } from '../../../core/types';
import type { SurfaceMap } from '../../surface-map';
import { type BatchItem, worldItem } from '../kit/batch';
import { ChunkSet } from '../kit/chunk-set';
import type { MeshBuilder } from '../kit/mesh-builder';
import { kindCode, MATTE_METAL, TINT } from '../templates/material-rules';
import type { TemplateLibrary } from '../templates/template-library';
import { cable } from './catenary';

const COLORS = ['#141519', '#1c1d22', '#24252a', '#33343a', '#1a1b1f'] as const;
const MAX_SPAN = 52;
const tmpA = new Vector3();
const tmpB = new Vector3();

export interface Wires {
  items: BatchItem[];
  spans: number;
}

/** first building facade hit walking from (x, z) along (dx, dz), or null */
function facade(surface: SurfaceMap, x: number, z: number, dx: number, dz: number, max: number): { x: number; z: number } | null {
  for (let s = 0.5; s <= max; s += 0.5) {
    if (surface.at(x + dx * s, z + dz * s) === Surface.Building) return { x: x + dx * (s - 0.15), z: z + dz * (s - 0.15) };
  }
  return null;
}

function strand(mb: MeshBuilder, rng: Rng, a: Vector3, b: Vector3, sag: number, r: number): void {
  // TINT.cable lets the city shader dissolve cables that cross in front of the rider (city-shader CITY_PROJECT_VERTEX)
  mb.color(rng.pick(COLORS)).surf(0.8, MATTE_METAL).kind(kindCode(TINT.cable, 0));
  const segs = Math.max(6, Math.min(16, Math.round(a.distanceTo(b) / 2.4)));
  cable(mb, a, b, sag, r, segs);
}

/**
 * Bangkok's overhead tangle: several sagging cables between consecutive poles of each pole chain (meta.chain /
 * meta.at), loose bundles on the house side, service drops to the facades and the odd cable across the street.
 * Chunked uber-format geometry for the city batch. `density` = QualitySettings.wireDensity.
 */
export function buildWires(data: CityData, matrices: readonly Matrix4[], templates: TemplateLibrary, surface: SurfaceMap, rng: Rng, density: number): Wires {
  const chunks = new ChunkSet();
  const chains = new Map<string, Array<{ p: Placement; m: Matrix4 }>>();
  data.placements.forEach((p, i) => {
    if (p.asset !== 'prop_power_pole' || !p.meta?.chain) return;
    const list = chains.get(p.meta.chain) ?? [];
    list.push({ p, m: matrices[i] });
    chains.set(p.meta.chain, list);
  });
  if (chains.size === 0) return { items: [], spans: 0 };
  const anchors = [0, 1, 2, 3].map((k) => templates.get('prop_power_pole').anchors.get(`wire_${k}`) ?? new Vector3(0, 8.5, 0));
  let spans = 0;
  for (const list of chains.values()) {
    list.sort((a, b) => Number(a.p.meta?.at) - Number(b.p.meta?.at));
    for (let i = 0; i < list.length; i++) {
      const { p, m } = list[i];
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const mb = chunks.at(p.pos.x, p.pos.z);
      const home = facade(surface, p.pos.x, p.pos.z, -fx, -fz, 7);
      for (let d = 0; home && d < 1 + (rng.chance(density) ? 1 : 0); d++) {
        tmpA.copy(anchors[rng.chance(0.5) ? 1 : 3]).applyMatrix4(m);
        const along = rng.range(-6, 6);
        tmpB.set(home.x - fz * along, rng.range(5.0, 6.8), home.z + fx * along);
        strand(mb, rng, tmpA, tmpB, rng.range(0.2, 0.5), 0.012);
      }
      const over = rng.chance(0.3 * density) ? facade(surface, p.pos.x, p.pos.z, fx, fz, 30) : null;
      if (over) {
        tmpA.copy(anchors[0]).applyMatrix4(m);
        strand(mb, rng, tmpA, tmpB.set(over.x, rng.range(6.2, 7.4), over.z), rng.range(0.5, 1.0), 0.016);
      }
      if (i + 1 >= list.length) continue;
      const next = list[i + 1];
      const len = Math.hypot(next.p.pos.x - p.pos.x, next.p.pos.z - p.pos.z);
      if (len > MAX_SPAN) continue;
      spans++;
      const span = chunks.at((p.pos.x + next.p.pos.x) / 2, (p.pos.z + next.p.pos.z) / 2);
      for (let k = 0; k < 4; k++) {
        const a = anchors[k].clone().applyMatrix4(m);
        const b = anchors[k].clone().applyMatrix4(next.m);
        const n = 1 + (rng.chance(0.65 * density) ? 1 : 0) + (rng.chance(0.3 * density) ? 1 : 0);
        for (let w = 0; w < n; w++) {
          tmpA.copy(a).add(new Vector3(rng.range(-0.06, 0.06), rng.range(-0.05, 0.02), rng.range(-0.06, 0.06)));
          tmpB.copy(b).add(new Vector3(rng.range(-0.06, 0.06), rng.range(-0.05, 0.02), rng.range(-0.06, 0.06)));
          strand(span, rng, tmpA, tmpB, len * rng.range(0.03, 0.05) + w * 0.14, rng.pick([0.013, 0.017, 0.022, 0.03]));
        }
        if ((k === 1 || k === 3) && rng.chance(0.45 * density)) {
          const sag = len * rng.range(0.045, 0.065);
          for (let w = 0; w < 4; w++) {
            tmpA.copy(a).add(new Vector3(rng.range(-0.04, 0.04), -0.08 - w * 0.03, rng.range(-0.04, 0.04)));
            tmpB.copy(b).add(new Vector3(rng.range(-0.04, 0.04), -0.08 - w * 0.03, rng.range(-0.04, 0.04)));
            strand(span, rng, tmpA, tmpB, sag + rng.range(0, 0.25), rng.pick([0.035, 0.05, 0.06]));
          }
        }
      }
    }
  }
  return { items: chunks.builders().map((b) => worldItem(b.toGeometry('uber'))), spans };
}
