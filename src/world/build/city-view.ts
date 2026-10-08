import { Group } from 'three';
import type { CityData } from '../../core/types';
import { DISTRICTS } from '../districts';
import { buildSurfaceMap } from '../gen/surface-build';
import { CityDynamics } from './city-dynamics';
import { edgeSpans } from './ground/edge-spans';
import { buildGround } from './ground/ground-build';
import { groundStyle } from './ground/ground-style';
import { medianRuns } from './ground/median-build';
import { placeSpeedBumps } from './ground/speed-bumps';
import { CityHeights, lotPlazas, parkAreas } from './heights';
import { buildMarkings } from './markings/markings-build';
import { CityMaterials } from './materials';
import { buildFences } from './overhead/fences';
import { buildHedges } from './overhead/hedges';
import { buildLanterns } from './overhead/lanterns';
import { buildWires } from './overhead/wires';
import { buildSigns } from './signs/sign-build';
import { PaletteRegistry } from './templates/palette-registry';
import { placementMatrices } from './templates/placement-matrix';
import { extraBands } from './templates/lod-bands';
import { buildPropBatches } from './templates/prop-batch';
import { TemplateLibrary } from './templates/template-library';
import { ViaductFade } from './templates/viaduct-fade';
import type { CityFrame, CityView, CityViewCtx, CityViewStats } from './types';

/**
 * Build the visual city for a CityData: chunked ground (roads, gutters, curbs, sidewalks, medians, lots, humps),
 * painted markings, every building / prop as an instance of its baked template in one BatchedMesh (plus wires,
 * fences, hedges, lanterns), the sign atlas, and the per-frame systems (signals, BTS trains, night pools, puddles).
 */
export function buildCityView(data: CityData, ctx: CityViewCtx): CityView {
  const t0 = performance.now();
  const phases: Record<string, number> = {};
  let mark = t0;
  const lap = (name: string): void => {
    const now = performance.now();
    phases[name] = Math.round(now - mark);
    mark = now;
  };
  const root = new Group();
  root.name = 'city_view';
  const { rng, quality } = ctx;
  const mats = new CityMaterials();
  const surface = buildSurfaceMap(data);
  const heights = new CityHeights(data, surface);
  const spans = edgeSpans(data.nodes, data.edges, data.bounds);
  const placedBumps = placeSpeedBumps(data, rng.fork('bumps'));
  const speedBumps = placedBumps.map((b) => b.bump);
  heights.setBumps(speedBumps);
  const medians = medianRuns(data.colliders);
  const ground = buildGround({
    data, spans, style: groundStyle(data.district), bumps: speedBumps, medians, material: mats.ground.material,
    busStops: data.placements.filter((p) => p.asset === 'prop_bus_stop').map((p) => p.pos),
    plazas: lotPlazas(data), lawns: parkAreas(data),
  });
  lap('ground');
  const markings = buildMarkings(data, spans, placedBumps, rng.fork('markings'));
  lap('markings');

  const templates = new TemplateLibrary(ctx.assets);
  const registry = new PaletteRegistry();
  const matrices = placementMatrices(data.placements, heights);
  for (const p of data.placements) templates.get(p.asset);
  lap('templates');
  const wires = buildWires(data, matrices, templates, surface, rng.fork('wires'), quality.wireDensity);
  const street = [
    ...buildFences(data.frontages), ...buildHedges(medians, data.placements, rng.fork('hedges'), quality.propDensity),
    ...(DISTRICTS[data.district].ambience.lanterns ? buildLanterns(data, data.lanes, rng.fork('lanterns')) : []),
  ];
  const extras = [
    ...wires.items.map((item) => ({ item, bands: extraBands('wires', quality.drawDistance) })),
    ...street.map((item) => ({ item, bands: extraBands('street', quality.drawDistance) })),
  ];
  const props = buildPropBatches({
    placements: data.placements, matrices, templates, registry, extras, material: mats.city.material, glassMaterial: mats.glass,
    drawDistance: quality.drawDistance,
  });
  mats.city.setPalette(registry.hexes);
  const shutter = templates.get('bld_shophouse_3f').shutter;
  if (shutter) mats.city.setShutter(shutter[0], shutter[1]);
  lap('props');
  const viaduct = props.mesh ? new ViaductFade(props.mesh, data.placements, props.instanceOf) : null;
  const signs = buildSigns(data, matrices, templates);
  lap('signs');
  for (const m of [ground.mesh, markings.mesh, props.mesh, props.glass, props.casters, signs.mesh]) if (m) root.add(m);
  const dyn = new CityDynamics(root, {
    data, matrices, templates, heights, glows: signs.glows, puddleSpots: markings.puddleSpots, cityMaterial: mats.city.material,
  });

  lap('dynamics');
  let time = 0;
  let first = true;
  const stats: CityViewStats = {
    instances: props.instances, templates: templates.size, groundChunks: ground.chunks, signs: signs.count, signAtlas: signs.atlas,
    wireSpans: wires.spans, lightPools: dyn.pools.mesh.count, puddles: markings.puddleSpots.length,
    buildMs: Math.round(performance.now() - t0), phases,
  };
  return {
    root,
    speedBumps,
    puddleSpots: markings.puddleSpots,
    groundHeight: (x, z) => heights.ground(x, z),
    update(dt: number, f: CityFrame): void {
      time += dt;
      const lamps = f.lamps ?? f.night;
      mats.city.setLight({ lamps, night: f.night, time });
      mats.city.setFocus(f.focus, f.focus ? heights.ground(f.focus.x, f.focus.z) : 0);
      mats.ground.setWet(f.wet);
      markings.setWet(f.wet);
      signs.setLamps(lamps);
      props.lod?.update(dt, f.camPos, first);
      viaduct?.update(dt, f.camPos, f.focus);
      first = false;
      dyn.update(dt, time, f, lamps);
    },
    stats: () => stats,
    dispose(): void {
      root.removeFromParent();
      dyn.dispose();
      ground.mesh?.dispose();
      markings.dispose();
      signs.dispose();
      props.mesh?.dispose();
      props.glass?.dispose();
      props.casters?.dispose();
      templates.dispose();
      mats.dispose();
    },
  };
}
