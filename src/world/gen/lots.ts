import type { Vec2 } from '../../core/types';
import type { DistrictDef, LotKind, PoiSpec } from './district-types';
import type { ReserveSpec } from './layout-types';
import { lotFromRect, type LotFrame } from './lot-frame';
import { LotKit } from './lot-kit';
import { buildMall, buildPark, buildShrine, buildTemple, type LotInfo } from './lot-landmarks';
import type { RoadNet } from './net-types';
import type { PlaceCtx } from './place-ctx';
import { distToSeg } from './seg-math';

export interface PlacedLot {
  key: string;
  kind: LotKind;
  lot: LotFrame;
}

const BUILDERS: Record<LotKind, (K: LotKit, info: LotInfo) => boolean> = {
  temple: buildTemple,
  park: buildPark,
  mall: buildMall,
  shrine: buildShrine,
};

/** edge of `line` closest to point p (the road a lot fronts) */
export function edgeOfLine(net: RoadNet, line: number, p: Vec2): number {
  let best = -1;
  let bestD = Infinity;
  net.edges.forEach((e, i) => {
    if (net.edgeLine[i] !== line) return;
    const d = distToSeg(p, { a: net.nodes[e.a].pos, b: net.nodes[e.b].pos });
    if (d < bestD) [best, bestD] = [i, d];
  });
  return best;
}

/** lot display info: sign text from the lot table, POI names from the district POI pool */
export function lotInfo(def: DistrictDef, key: string, sign?: string): LotInfo {
  const poi: PoiSpec | undefined = def.pois.find((p) => p.where === `lot:${key}`);
  return { sign, poi: poi?.name, poiTh: poi?.th };
}

/** Build every landmark lot reserved during layout (temples, parks, malls, shrines). */
export function placeLandmarks(net: RoadNet, ctx: PlaceCtx, def: DistrictDef, reserves: readonly ReserveSpec[]): PlacedLot[] {
  const out: PlacedLot[] = [];
  for (const r of reserves) {
    const spec = def.lots.find((l) => l.key === r.key);
    if (!spec) continue;
    const c = { x: (r.rect.minX + r.rect.maxX) / 2, z: (r.rect.minZ + r.rect.maxZ) / 2 };
    const lot = lotFromRect(r.rect, r.facing, edgeOfLine(net, r.line, c));
    if (lot.edge < 0) continue;
    if (BUILDERS[spec.kind](new LotKit(ctx, lot), lotInfo(def, spec.key, spec.sign))) out.push({ key: spec.key, kind: spec.kind, lot });
  }
  return out;
}
