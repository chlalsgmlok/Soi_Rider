import type { CityData } from '../core/types';
import { SurfaceMap } from './surface-map';
import { DECK_HALF } from './gen/shade-map';

/** underside of the BTS viaduct deck (m) — the deck model spans z 9.5–11 (docs/ASSET_SPEC.md) */
export const DECK_UNDERSIDE = 9.3;
/** underside of an elevated BTS station box (m) — the station spans 8–17 */
export const STATION_UNDERSIDE = 7.8;

/**
 * Heights of overhead structures you can ride under (0 = open sky) on a 1 m raster: the skytrain deck along skytrain
 * edges and the stations. Chase cameras stay below these so a rider under the viaduct is filmed along the street
 * beneath it instead of through the deck. Codes are decimetres in a Uint8 raster.
 */
export class CeilingMap {
  private readonly map: SurfaceMap;

  constructor(data: CityData) {
    this.map = new SurfaceMap(data.bounds, 1);
    const deck = Math.round(DECK_UNDERSIDE * 10);
    const station = Math.round(STATION_UNDERSIDE * 10);
    for (const e of data.edges) {
      if (e.skytrain) this.map.fillRect(data.nodes[e.a].pos, e.dir, -6, e.length + 6, -DECK_HALF, DECK_HALF, deck);
    }
    for (const p of data.placements) {
      if (p.asset !== 'bts_station') continue;
      this.map.fillRect(p.pos, { x: Math.sin(p.heading), z: Math.cos(p.heading) }, -30, 30, -9, 9, station);
    }
  }

  /** underside height of the structure overhead at a point (m), 0 under open sky */
  at(x: number, z: number): number {
    return this.map.at(x, z) / 10;
  }
}
