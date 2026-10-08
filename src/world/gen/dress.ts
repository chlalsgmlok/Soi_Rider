import type { CityData, Connector, Lane, POI, Vec2 } from '../../core/types';
import type { Rng } from '../../core/rng';
import { headingOf } from '../../core/math2d';
import type { DistrictDef } from './district-types';
import { placeBts } from './bts';
import { placeBackRows, placeFrontages } from './frontages';
import { placeInfill } from './infill';
import { placeSoiSigns, placeTrafficLights } from './junction-props';
import type { LaneIndex } from './lanes';
import type { Layout } from './layout-types';
import { placeLandmarks, type PlacedLot } from './lots';
import { placeMedians } from './medians';
import type { RoadNet } from './net-types';
import type { PlaceCtx } from './place-ctx';
import { placePois } from './pois';
import { onBounds } from './road-geometry';
import { allSides } from './side-frame';
import { placePoiSites, placeRecipeTowers, selectPois } from './sites';
import { placeSkyline } from './skyline';
import { curbPoint, placeSpawn, type SpawnSite } from './spawn';
import { placeStreetDressing } from './street-dressing';
import { placeStreetFood } from './street-food';
import { placeStreetLines } from './street-lines';

export interface DressInput {
  net: RoadNet;
  layout: Layout;
  lanes: readonly Lane[];
  index: LaneIndex;
  connectors: readonly Connector[];
  ctx: PlaceCtx;
  def: DistrictDef;
}

/** the BTS station goes next to the landmark that fronts the skytrain road, else at its busiest junction */
function stationTarget(net: RoadNet, lots: readonly PlacedLot[]): Vec2 {
  const onLine = lots.find((l) => net.edges[l.lot.edge]?.skytrain);
  if (onLine) return onLine.lot.c;
  const nodes = net.nodes.filter((n) => n.signal && n.edges.some((id) => net.edges[id].skytrain));
  return nodes.sort((a, b) => b.edges.length - a.edges.length)[0]?.pos ?? { x: 0, z: 0 };
}

/** fallback spawn when the layout has no usable home soi: the longest curb lane of a soi (or any road) */
function fallbackSpawn(lanes: readonly Lane[], net: RoadNet): SpawnSite {
  const pool = lanes.filter((l) => net.edges[l.edge].cls === 'soi');
  const l = (pool.length ? pool : lanes).reduce((a, b) => (b.length > a.length ? b : a));
  return { pos: curbPoint(l, l.length / 2), heading: headingOf(l.dir), lane: l.id, edge: l.edge };
}

/**
 * Everything on top of the road network, in priority order: landmark lots → BTS viaduct → medians → POI sites
 * and towers → shophouse frontages → back rows → the rider's win stand → junction furniture → street lines → food stalls →
 * dressing → named stops → back-lot infill → skyline. Each stage has its own forked Rng stream.
 */
export function dressCity(I: DressInput, rng: Rng): { pois: POI[]; spawn: CityData['spawn'] } {
  const { net, ctx, def } = I;
  const sides = allSides(net.nodes, net.edges, net.bounds);
  const lots = placeLandmarks(net, ctx, def, I.layout.reserves);
  const bts = placeBts(net, ctx, rng.fork('bts'), stationTarget(net, lots));
  placeMedians(net, ctx, rng.fork('medians'));
  const hasDeadEnd = net.nodes.some((n) => n.edges.length === 1 && !onBounds(n.pos, net.bounds));
  const specs = selectPois(def, rng.fork('poi-select'), lots, bts !== null && !Number.isNaN(bts.station), hasDeadEnd);
  const sites = placePoiSites(ctx, sides, specs, rng.fork('sites'));
  placeRecipeTowers(ctx, def, sides, rng.fork('towers'));
  placeFrontages(net, ctx, def, sides, rng.fork('frontages'));
  placeBackRows(ctx, def, sides, rng.fork('backrows'));
  const spawn = placeSpawn(net, I.lanes, I.index, ctx, def, I.layout.spawnLine, rng.fork('spawn')) ?? fallbackSpawn(I.lanes, net);
  placeTrafficLights(net, ctx);
  placeSoiSigns(net, ctx, rng.fork('signs'));
  placeStreetLines(net, ctx, def, sides, rng.fork('lines'));
  placeStreetFood(net, ctx, def, sides, rng.fork('food'));
  placeStreetDressing(net, ctx, def, sides, rng.fork('dressing'));
  const pois = placePois({ ...I, specs, lots, sites, bts, spawn }, rng.fork('pois'));
  placeInfill(ctx, def, net.bounds, rng.fork('infill'));
  placeSkyline(net, ctx, def, rng.fork('skyline'));
  return { pois, spawn: { pos: spawn.pos, heading: spawn.heading, poi: 0 } };
}
