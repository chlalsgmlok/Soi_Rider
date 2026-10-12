import type { CityQuery, Lane, OBB, PlayerState, TrafficAgentView, TrafficQuery } from '../../core/types';
import { approachAxis, signalAspect } from '../../world/build/lights/signal-phase';

/** comfortable bot braking (m/s²) */
export const BOT_BRAKE = 2.6;
/** stand-off kept behind traffic when rolling (m, nose to tail) */
const STANDOFF = 1.6;
/** creeping speed allowed up to CREEP_GAP from an obstacle (manoeuvring around queue corners) */
const CREEP = 0.9;
const CREEP_GAP = 0.35;
/** bike nose distance ahead of its centre (m) */
const BIKE_NOSE = 1.0;
/** half the corridor the bike needs (mirror span / 2 + margin, m) */
const CORRIDOR = 0.5;
const LOOK = 28;

/** speed that still stops within `gap` metres at BOT_BRAKE */
export const stopSpeed = (gap: number): number => Math.sqrt(2 * BOT_BRAKE * Math.max(0, gap));

/** allowed speed for a free run of `gap` metres between the bike's nose and an obstacle */
const gapSpeed = (gap: number): number => (gap <= CREEP_GAP ? 0 : Math.max(CREEP, stopSpeed(gap - STANDOFF)));

const cx = [1, 1, -1, -1];
const cz = [1, -1, -1, 1];

/**
 * Nearest point ahead of an OBB inside the corridor band |side| ≤ CORRIDOR (frame: origin (ox, oz), unit direction
 * (fx, fz), side offset by `shift`), as metres along the direction; Infinity when the box misses the band or lies
 * entirely behind.
 */
function nearestInBand(o: OBB, ox: number, oz: number, fx: number, fz: number, shift: number): number {
  const ax = Math.sin(o.angle);
  const az = Math.cos(o.angle);
  let best = Infinity;
  let pa = 0;
  let ps = 0;
  for (let k = 0; k <= 4; k++) {
    const i = k % 4;
    // corner = centre + right·hw·cx + forward·hl·cz, right(a) = (−az, ax)
    const px = o.cx - az * o.hw * cx[i] + ax * o.hl * cz[i] - ox;
    const pz = o.cz + ax * o.hw * cx[i] + az * o.hl * cz[i] - oz;
    const along = px * fx + pz * fz;
    const side = -px * fz + pz * fx - shift;
    if (k > 0) {
      const ds = side - ps;
      let lo = 0;
      let hi = 1;
      if (Math.abs(ds) < 1e-9) {
        if (Math.abs(ps) > CORRIDOR) hi = -1;
      } else {
        const ta = (-CORRIDOR - ps) / ds;
        const tb = (CORRIDOR - ps) / ds;
        lo = Math.max(0, Math.min(ta, tb));
        hi = Math.min(1, Math.max(ta, tb));
      }
      if (lo <= hi) {
        const a1 = pa + (along - pa) * lo;
        const a2 = pa + (along - pa) * hi;
        // only what reaches ahead of the bike's centre counts; a box across the centre line is touching us (0)
        if (Math.max(a1, a2) > 0) best = Math.min(best, Math.max(0, Math.min(a1, a2)));
      }
    }
    pa = along;
    ps = side;
  }
  return best;
}

/**
 * Fastest safe speed for the bot given the vehicles and people in its corridor: the corridor runs from the bike along
 * unit direction (fx, fz) — where it is about to go — offset sideways by `shift` (+ = right, filtering).
 */
export function obstacleSpeed(
  s: PlayerState, fx: number, fz: number, traffic: TrafficQuery, scratch: TrafficAgentView[], shift: number,
): number {
  let v = Infinity;
  const n = traffic.near(s.pos, LOOK, scratch);
  for (let i = 0; i < n; i++) {
    const a = scratch[i];
    let along = nearestInBand(a.obb, s.pos.x, s.pos.z, fx, fz, shift);
    // mirrors stick out past the body box — the classic lane-split scrape
    for (const m of a.mirrors) along = Math.min(along, nearestInBand(m, s.pos.x, s.pos.z, fx, fz, shift));
    if (along < LOOK) v = Math.min(v, gapSpeed(along - BIKE_NOSE));
  }
  for (const p of traffic.pedestrians()) {
    const dx = p.pos.x - s.pos.x;
    const dz = p.pos.z - s.pos.z;
    const ahead = dx * fx + dz * fz;
    if (ahead <= 0 || ahead > LOOK) continue;
    const side = -dx * fz + dz * fx - shift;
    if (Math.abs(side) > p.radius + CORRIDOR + 0.3) continue;
    v = Math.min(v, gapSpeed(ahead - p.radius - BIKE_NOSE - 0.5));
  }
  return v;
}

/** stops the bot at the stop line of a red / amber signal on the lane it follows (Infinity = go) */
export function signalSpeed(s: PlayerState, city: CityQuery, traffic: TrafficQuery): number {
  if (s.counterflow || s.centerline) return Infinity; // riding against the lane (also when tolerated by the centre line)
  let l: Lane | null = s.laneId >= 0 ? city.data.lanes[s.laneId] : null;
  if (!l) {
    // filtering between lanes: the nearest lane running the bike's way
    const hit = city.nearestLane(s.pos, 4);
    if (hit && hit.lane.dir.x * Math.sin(s.heading) + hit.lane.dir.z * Math.cos(s.heading) > 0.3) l = hit.lane;
  }
  if (!l) return Infinity;
  const e = city.data.edges[l.edge];
  const node = city.data.nodes[l.forward ? e.b : e.a];
  if (!node.signal) return Infinity;
  const toLine = (l.end.x - s.pos.x) * l.dir.x + (l.end.z - s.pos.z) * l.dir.z;
  if (toLine < 0.5) return Infinity;
  const sv = traffic.signal(node.id);
  if (!sv || signalAspect(sv.phase, approachAxis(e.dir)) === 'green') return Infinity;
  return stopSpeed(toLine - BIKE_NOSE - 0.3);
}
