import { STARTER_LOADOUT } from '../../core/config/catalog';
import { Rng } from '../../core/rng';
import type { CityData, JobOffer, PassengerTrait, POI, PoiKind, RunConfig, RunStats } from '../../core/types';
import { createRunStats } from '../run-stats';

/** Deterministic fixtures for src/logic unit tests (not imported by game code). */

const KINDS: readonly PoiKind[] = [
  'market', 'mall', 'temple', 'bts', 'hotel', 'office', 'condo', 'food', 'park', 'hospital', 'school', 'shrine', 'pier',
];

const poi = (id: number, kind: PoiKind, x: number, z: number): POI => ({
  id, kind, name: `${kind} ${id}`, nameTh: `ที่ ${id}`, pos: { x, z }, lane: id, heading: 0,
  landmark: kind === 'temple' || kind === 'mall' || kind === 'shrine',
});

function cityOf(pois: POI[], half: number): CityData {
  const stand = pois[0];
  return {
    seed: 1, district: 'sukhumvit',
    bounds: { minX: -half, minZ: -half, maxX: half, maxZ: half },
    nodes: [], edges: [], lanes: [], connectors: [], pois, colliders: [], placements: [], frontages: [],
    spawn: { pos: { ...stand.pos }, heading: 0, poi: stand.id },
  };
}

/**
 * A synthetic city: the win stand (POI 0) at the origin and 8 rays of POIs at fixed radii, so pickups exist at
 * 120–450 m (estimated) and drops exist in every distance band.
 */
export function makeCity(radii: readonly number[] = [100, 160, 220, 280, 330, 500, 650, 800, 950, 1100, 1250]): CityData {
  const pois: POI[] = [{ ...poi(0, 'win_stand', 0, 0), name: 'Soi 23 Win', nameTh: 'วินซอย 23' }];
  let id = 1;
  for (let ray = 0; ray < 8; ray++) {
    const a = (ray / 8) * Math.PI * 2;
    for (const r of radii) {
      pois.push({ ...poi(id, KINDS[id % KINDS.length], Math.sin(a) * r, Math.cos(a) * r), heading: a });
      id += 1;
    }
  }
  return cityOf(pois, 1500);
}

/**
 * Shaped like the generated district (a 520 m square, docs/ARCHITECTURE.md world): POIs on every third crossing of a
 * 60 m street grid, our stand off-centre at (−130, −10) and a second win stand that must never become a job.
 */
export function makeCompactCity(): CityData {
  const pois: POI[] = [poi(0, 'win_stand', -130, -10)];
  let id = 1;
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if ((i + 2 * j) % 3 !== 0) continue;
      pois.push(poi(id, KINDS[id % KINDS.length], -240 + i * 60, -240 + j * 60));
      id += 1;
    }
  }
  pois.push(poi(id, 'win_stand', 50, 20));
  return cityOf(pois, 260);
}

export function makeConfig(over: Partial<RunConfig> = {}): RunConfig {
  return {
    seed: 1234, tripNumber: 3, intensity: 'rush', timeOfDay: 'sunset',
    weather: { base: 'clear', haze: 0.1, events: [] }, district: 'sukhumvit', loadout: { ...STARTER_LOADOUT },
    ...over,
  };
}

export function makeJob(trait: PassengerTrait, fareBaht = 100, name = '쁠로이'): JobOffer {
  return {
    id: 'job-test', pickupPoi: 1, dropPoi: 2, estMeters: 800, approachMeters: 200, fareBaht, note: '테스트',
    passenger: {
      id: 'p-test', name, origin: '테스트', trait, rating: 4.8,
      look: { skin: '#D9A47A', shirt: '#9FD3C7', pants: '#2B3A5C', hair: 'hair_long', hairColor: '#1E1B1A' },
    },
  };
}

export function makeStats(over: Partial<RunStats> = {}): RunStats {
  return { ...createRunStats(300, 1000), timeSec: 240, finalComfort: 80, ...over };
}

/**
 * Like a real generated district (14–23 POIs scattered over the 520 m square, the stand somewhere inside): few
 * destinations, so the offer distances have little room to spread.
 */
export function makeSparseCity(seed: number, count = 17): CityData {
  const rng = new Rng(seed).fork('sparse-city');
  const pois: POI[] = [poi(0, 'win_stand', rng.range(-150, 150), rng.range(-150, 150))];
  for (let tries = 0; pois.length <= count && tries < 2000; tries++) {
    const pos = { x: rng.range(-240, 240), z: rng.range(-240, 240) };
    if (pois.some((p) => Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < 45)) continue;
    pois.push(poi(pois.length, KINDS[pois.length % KINDS.length], pos.x, pos.z));
  }
  return cityOf(pois, 260);
}
