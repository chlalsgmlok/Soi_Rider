import { type Matrix4, Vector3 } from 'three';
import type { CityData } from '../../../core/types';
import { LightPools } from '../../../engine/env/light-pools';
import type { CityHeights } from '../heights';
import type { SignGlow } from '../signs/sign-build';
import type { TemplateLibrary } from '../templates/template-library';

interface Spot {
  x: number;
  z: number;
  r: number;
  color: string;
  k: number;
}

const v = new Vector3();

/** local point of a placement in world space */
const local = (m: Matrix4, x: number, z: number): Vector3 => v.set(x, 0, z).applyMatrix4(m);

/**
 * Night light on the pavement as additive ground glows (engine LightPools — one draw, no real lights): street lamps,
 * open shop fronts, mini-marts, food carts, stands, the lit underside of the BTS station and coloured spill under
 * lit signs.
 */
export function buildLightPools(data: CityData, matrices: readonly Matrix4[], templates: TemplateLibrary, heights: CityHeights, glows: readonly SignGlow[]): LightPools {
  const spots: Spot[] = [];
  const lampAnchor = data.placements.some((p) => p.asset === 'prop_street_lamp') ? templates.get('prop_street_lamp').anchors.get('lamp') : undefined;
  data.placements.forEach((p, i) => {
    const m = matrices[i];
    const push = (x: number, z: number, r: number, color: string, k: number): void => {
      spots.push({ x, z, r, color, k });
    };
    if (p.asset === 'prop_street_lamp' && lampAnchor) {
      v.copy(lampAnchor).applyMatrix4(m);
      push(v.x, v.z, 6.5, '#ffbf73', 0.9);
    } else if (p.asset.startsWith('bld_shophouse') && !p.meta?.infill && !p.meta?.fringe && p.meta?.shutter !== 'closed') {
      local(m, 0, 1.5);
      push(v.x, v.z, 2.7, '#ffb15e', p.meta?.shutter === 'open' ? 0.62 : 0.4);
    } else if (p.asset === 'bld_minimart') {
      local(m, 0, 2.4);
      push(v.x, v.z, 5.2, '#e6f4ff', 0.75);
    } else if (p.asset === 'prop_food_cart') {
      push(p.pos.x, p.pos.z, 2.8, '#ffc372', 0.7);
    } else if (p.asset === 'prop_win_stand' || p.asset === 'prop_bus_stop') {
      push(p.pos.x, p.pos.z, 2.6, '#fff0cf', 0.45);
    } else if (p.asset === 'bts_station') {
      for (let s = -26; s <= 26; s += 8.5) {
        for (const x of [-6.5, 6.5]) {
          local(m, x, s);
          push(v.x, v.z, 5, '#e2ecff', 0.3);
        }
      }
    }
  });
  for (const g of glows) spots.push({ x: g.x, z: g.z, r: 2.2, color: g.color, k: g.strength });
  const pools = new LightPools(Math.max(1, spots.length));
  for (const s of spots) pools.add(new Vector3(s.x, heights.ground(s.x, s.z), s.z), s.r, s.color, s.k);
  pools.mesh.name = 'city_light_pools';
  return pools;
}
