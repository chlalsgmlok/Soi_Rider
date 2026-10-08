import type { CityData } from '../../core/types';
import { SurfaceMap } from '../surface-map';
import { buildingLine } from './road-profile';

/** awning depth over the sidewalk in front of shophouse rows (m) */
export const AWNING_DEPTH = 2.2;
/** half width of the BTS viaduct deck shadow band (m) */
export const DECK_HALF = 4.8;

const SHADED = 1;

/**
 * 1 m raster of shade for the heat mechanic: under the BTS viaduct / station, under shophouse awnings, under rain
 * tree canopies and bus-stop / win-stand shelters.
 */
export function buildShadeMap(data: CityData): SurfaceMap {
  const shade = new SurfaceMap(data.bounds, 1);
  for (const e of data.edges) {
    if (!e.skytrain) continue;
    shade.fillRect(data.nodes[e.a].pos, e.dir, -6, e.length + 6, -DECK_HALF, DECK_HALF, SHADED);
  }
  for (const f of data.frontages) {
    if (f.kind !== 'shophouse' && f.kind !== 'commercial') continue;
    const len = Math.hypot(f.b.x - f.a.x, f.b.z - f.a.z);
    if (len < 0.5) continue;
    const d = { x: (f.b.x - f.a.x) / len, z: (f.b.z - f.a.z) / len };
    const toStreet = { x: Math.sin(f.heading), z: Math.cos(f.heading) };
    const side = d.z * toStreet.x - d.x * toStreet.z >= 0 ? 1 : -1;
    const width = Math.min(AWNING_DEPTH, buildingLine(data.edges[f.edge]) - 0.3);
    if (side > 0) shade.fillRect(f.a, d, 0, len, 0, width, SHADED);
    else shade.fillRect(f.a, d, 0, len, -width, 0, SHADED);
  }
  for (const p of data.placements) {
    const f = { x: Math.sin(p.heading), z: Math.cos(p.heading) };
    if (p.asset === 'prop_raintree') shade.fillCircle(p.pos.x, p.pos.z, 4.2 * p.scale, SHADED);
    else if (p.asset === 'bts_station') shade.fillRect(p.pos, f, -30, 30, -9, 9, SHADED);
    else if (p.asset === 'prop_bus_stop' || p.asset === 'prop_win_stand') shade.fillRect(p.pos, f, -1.2, 1.2, -2.2, 2.2, SHADED);
    else if (p.asset === 'prop_umbrella') shade.fillCircle(p.pos.x, p.pos.z, 1.2, SHADED);
  }
  return shade;
}
