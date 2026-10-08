import { dist, headingOf, leftOf } from '../../../core/math2d';
import {
  type CityData, type CityQuery, type DistrictId, type Lane, type RoadEdge, type RoadNode, type StaticCollider, Surface,
  type Vec2,
} from '../../../core/types';
import { generateCity } from '../../../world';
import { shotCamera, shotTarget, type TitleShot, TITLE_SHOT, shotYaw } from './title-shot';
import { Sightlines } from '../shared/sightlines';

/** the fixed showcase city of the title diorama (deterministic: same junction every boot) */
export const TITLE_CITY: Readonly<{ seed: number; district: DistrictId }> = { seed: 3, district: 'sukhumvit' };

/** where the title camera, hero rider and traffic focus sit */
export interface TitleSite {
  /** the showcase junction (signalised); −1 when the city has none (fallback: the spawn soi) */
  node: number;
  /** the framed approach road into it (its lamp decides when the queue builds in front of the camera) */
  edge: number;
  /** heading along the approach toward the junction — the camera looks this way */
  heading: number;
  /** the junction centre (on the approach's centreline) */
  junction: Vec2;
  /** hero rider's kerb spot beside the queue (inbound curb side), facing the junction */
  hero: Vec2;
  /** the art direction resolved for this spot (yaw side and crane height chosen so nothing blocks the view) */
  shot: TitleShot;
}

interface Approach {
  node: RoadNode;
  edge: RoadEdge;
  /** lanes toward the junction / away from it, inner → curb */
  inbound: Lane[];
  outbound: Lane[];
}

/** tall blocks that would wall off (or swallow) the orbiting camera */
const TOWERS = new Set(['bld_condo', 'bld_office', 'bld_mall', 'bts_station', 'bts_pillar']);
/** the mockup-03 street life worth framing */
const CHARM = new Set([
  'prop_food_cart', 'prop_umbrella', 'prop_bougainvillea', 'prop_raintree', 'prop_palm', 'prop_banana', 'prop_pot_plant',
  'prop_spirit_house', 'prop_win_stand', 'prop_table',
]);
const CLASS_SCORE: Record<RoadEdge['cls'], number> = { main: 4, avenue: 5, soi: 0 };
/** metres from the junction the hero waits (tried in order) */
const HERO_BACK = [24, 22, 26, 20, 28, 18, 16, 14, 12, 10];
const near: StaticCollider[] = [];

const cache = new Map<string, CityData>();
/** the title's city (generated once per page); `city` overrides the showcase (dev / tests) */
export function titleCityData(city: { seed: number; district: DistrictId } = TITLE_CITY): CityData {
  const key = `${city.district}:${city.seed}`;
  let d = cache.get(key);
  if (!d) cache.set(key, (d = generateCity(city.seed, city.district)));
  return d;
}

function approaches(d: CityData): Approach[] {
  const b = d.bounds;
  const inside = (p: Vec2): boolean => p.x > b.minX + 90 && p.x < b.maxX - 90 && p.z > b.minZ + 90 && p.z < b.maxZ - 90;
  const out: Approach[] = [];
  for (const node of d.nodes) {
    if (!node.signal || !inside(node.pos)) continue;
    for (const id of node.edges) {
      const edge = d.edges[id];
      if (edge.skytrain || edge.oneWay || edge.length < 45) continue;
      const inFwd = edge.b === node.id;
      const lanes = d.lanes.filter((l) => l.edge === id).sort((x, y) => x.index - y.index);
      const inbound = lanes.filter((l) => l.forward === inFwd);
      const outbound = lanes.filter((l) => l.forward !== inFwd);
      if (inbound.length && outbound.length) out.push({ node, edge, inbound, outbound });
    }
  }
  return out;
}

function score(a: Approach, d: CityData): number {
  let s = CLASS_SCORE[a.edge.cls] + a.inbound.length + a.outbound.length * 0.5;
  if (a.node.edges.some((id) => d.edges[id].skytrain)) s -= 10;
  let charm = 0;
  let shops = 0;
  for (const p of d.placements) {
    const r = dist(p.pos, a.node.pos);
    if (r > 60) continue;
    if (TOWERS.has(p.asset)) s -= 6;
    else if (r < 42 && CHARM.has(p.asset)) charm++;
    else if (r < 42 && p.asset.startsWith('bld_shophouse')) shops++;
  }
  return s + Math.min(charm, 14) * 0.5 + Math.min(shops, 16) * 0.35;
}

/** point `s` metres along a lane, `lat` metres to its left (curb side) */
function lanePoint(l: Lane, s: number, lat: number): Vec2 {
  const left = leftOf(headingOf(l.dir));
  return { x: l.start.x + l.dir.x * s + left.x * lat, z: l.start.z + l.dir.z * s + left.z * lat };
}

/** clear sidewalk spots just over the curb beside the queue, `HERO_BACK` metres before the stop line (best first) */
function heroSpots(q: CityQuery, a: Approach): Vec2[] {
  const curb = a.inbound[a.inbound.length - 1];
  const out: Vec2[] = [];
  for (const back of HERO_BACK) {
    const s = curb.length - back;
    if (s < 6) continue;
    const lat = curb.width / 2 + 0.85;
    const free = [-0.75, 0, 0.75].every((k) => {
      const c = lanePoint(curb, s + k, lat);
      return q.surfaceAt(c.x, c.z) === Surface.Sidewalk && q.staticNear(c, 0.5, near) === 0;
    });
    if (free) out.push(lanePoint(curb, s, lat));
  }
  return out;
}

/** the camera sees the hero, the frame centre and the junction from both ends and the middle of its sweep */
function inView(lines: Sightlines, heading: number, junction: Vec2, hero: Vec2, shot: TitleShot): boolean {
  for (const phase of [-1, 0, 1]) {
    const yaw = shotYaw(heading, shot, phase);
    const target = shotTarget(hero, yaw, shot);
    const cam = shotCamera(target, yaw, shot);
    if (!lines.clear(cam, hero, 1.2) || !lines.clear(cam, target, 0.3) || !lines.clear(cam, junction, 0.3)) return false;
  }
  return true;
}

/** framing variants in order of preference: the authored yaw side first, then the mirror side; craning up to see over trees */
function variants(shot: TitleShot): TitleShot[] {
  const out: TitleShot[] = [];
  for (const side of [1, -1]) {
    for (const lift of [0, 1, 2, 3]) out.push({ ...shot, yaw: shot.yaw * side, height: shot.height + lift * 1.6, radius: shot.radius - lift * 0.8 });
  }
  return out;
}

/**
 * The title's showcase spot: the most charming two-way approach into a signalised junction (shophouses, food stalls,
 * trees; no towers or skytrain) whose kerb beside the queue has a clear spot for the hero that the orbiting camera
 * can see — along with the junction — over every tree and roof (picking the yaw side and crane height that make it so).
 * `rank` > 0 takes the next-best candidates (dev exploration).
 */
export function pickTitleSite(q: CityQuery, shot: TitleShot = TITLE_SHOT, rank = 0): TitleSite {
  const d = q.data;
  const lines = new Sightlines(q, d);
  const ranked = approaches(d).map((a) => ({ a, s: score(a, d) })).sort((x, y) => y.s - x.s);
  const shots = variants(shot);
  let skip = rank;
  for (const { a } of ranked) {
    const heading = headingOf(a.inbound[0].dir);
    const junction = { ...a.node.pos };
    const spots = heroSpots(q, a);
    for (const v of shots) {
      const hero = spots.find((h) => inView(lines, heading, junction, h, v));
      if (!hero) continue;
      if (skip-- > 0) break;
      return { node: a.node.id, edge: a.edge.id, heading, junction, hero, shot: v };
    }
  }
  const s = d.spawn;
  return { node: -1, edge: -1, heading: s.heading, junction: { ...s.pos }, hero: { ...s.pos }, shot };
}
