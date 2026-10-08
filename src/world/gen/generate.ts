import type { CityData, DistrictId } from '../../core/types';
import { Rng } from '../../core/rng';
import { DISTRICTS } from '../districts';
import { SurfaceMap } from '../surface-map';
import { arrange } from './arrangement';
import { CITY_BOUNDS, citySeed } from './city-bounds';
import { buildConnectors } from './connectors';
import { dressCity } from './dress';
import { computeJunctions } from './junctions';
import { LaneClearance } from './lane-clearance';
import { buildLanes } from './lanes';
import { buildLayout } from './layout';
import { applyProfiles, insertOpenings } from './net-profiles';
import { chooseOneWays } from './one-way';
import { PlaceCtx } from './place-ctx';
import { rememberSurface } from './surface-cache';
import { paintNetwork } from './surface-paint';

/**
 * Procedural Bangkok district as pure data. Deterministic for (seed, district); no three.js.
 * Pipeline: layout → planar graph → cross-sections → median openings → junctions → one-way sois → lanes →
 * connectors → surface raster → lots / BTS / buildings / street props → POIs + spawn → infill → skyline.
 */
export function generateCity(seed: number, district: DistrictId): CityData {
  const def = DISTRICTS[district];
  const root = new Rng(citySeed(seed, district));
  const bounds = { ...CITY_BOUNDS };
  const layout = buildLayout(def, root.fork('layout'));
  const net = arrange(layout, bounds);
  applyProfiles(net, def.layout, layout.spawnLine, root.fork('profile'));
  insertOpenings(net, def.layout.openings, root.fork('openings'));
  computeJunctions(net);
  chooseOneWays(net, def.layout.oneWay, layout.spawnLine, root.fork('oneway'));
  const { lanes, index } = buildLanes(net);
  const connectors = buildConnectors(net, lanes, index);
  const surface = new SurfaceMap(bounds);
  paintNetwork(surface, net.nodes, net.edges, net.trims, bounds);
  const ctx = new PlaceCtx(surface, new LaneClearance(bounds, lanes), root.fork('variant'));
  const { pois, spawn } = dressCity({ net, layout, lanes, index, connectors, ctx, def }, root.fork('dress'));
  const data: CityData = {
    seed, district, bounds, nodes: net.nodes, edges: net.edges, lanes, connectors, pois,
    colliders: ctx.colliders, placements: ctx.placements, frontages: ctx.frontages, spawn,
  };
  rememberSurface(data, surface);
  return data;
}
