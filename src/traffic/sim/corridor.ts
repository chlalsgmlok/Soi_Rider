import type { LeaderKind, Vehicle } from './vehicle';
import type { ObstacleKind, Obstacles } from './obstacles';
import type { Tracks } from './tracks';

const MAX_SEGS = 48;
const MAX_HITS = 256;
/** largest half extent of anything we may meet (bus half length + slack) */
const PAD = 7;
const MARGIN: Record<ObstacleKind, number> = { vehicle: 0.12, pedestrian: 0.4, player: 0.22 };

/** The nearest obstacle inside a vehicle's swept path ahead. */
export interface AheadHit {
  /** bumper gap (m), Infinity when the corridor is clear */
  gap: number;
  /** obstacle speed along the path (≥ 0) */
  speed: number;
  kind: LeaderKind;
  /** obstacle index in `Obstacles` (-1 none) */
  index: number;
}

/**
 * Sweeps a vehicle's corridor along the planned route — current track, then the next connector / lane … — and
 * finds the first obstacle whose box intersects it. `gather` projects every nearby obstacle onto the route
 * centreline once; `nearest` then answers for any lateral offset and half width, so a motorbike can compare many
 * candidate slots for the price of one sweep. Covers the lane leader, leaders across a connector chain, cars inside
 * the junction box, lane changers cutting in, motorbikes, jaywalkers and the player.
 */
export class CorridorScanner {
  private readonly ax = new Float64Array(MAX_SEGS);
  private readonly az = new Float64Array(MAX_SEGS);
  private readonly dx = new Float64Array(MAX_SEGS);
  private readonly dz = new Float64Array(MAX_SEGS);
  private readonly len = new Float64Array(MAX_SEGS);
  private readonly start = new Float64Array(MAX_SEGS);
  private n = 0;
  private readonly cand: number[] = [];
  /** gathered hits: along the route (centre), lateral from the centreline, half extents across / along, speed */
  private readonly hAlong = new Float64Array(MAX_HITS);
  private readonly hLat = new Float64Array(MAX_HITS);
  private readonly hAcross = new Float64Array(MAX_HITS);
  private readonly hExt = new Float64Array(MAX_HITS);
  private readonly hSpeed = new Float64Array(MAX_HITS);
  private readonly hMargin = new Float64Array(MAX_HITS);
  private readonly hIndex = new Int32Array(MAX_HITS);
  private hits = 0;
  private halfLen = 1;

  constructor(private readonly tracks: Tracks, private readonly obstacles: Obstacles) {}

  /** project every obstacle near v's route (lookahead metres) onto the route centreline */
  gather(v: Vehicle, self: number, lookahead: number): void {
    this.buildPath(v, lookahead);
    this.hits = 0;
    this.halfLen = v.halfLen;
    if (this.n === 0) return;
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let k = 0; k < this.n; k++) {
      const ex = this.ax[k] + this.dx[k] * this.len[k];
      const ez = this.az[k] + this.dz[k] * this.len[k];
      x0 = Math.min(x0, this.ax[k], ex);
      x1 = Math.max(x1, this.ax[k], ex);
      z0 = Math.min(z0, this.az[k], ez);
      z1 = Math.max(z1, this.az[k], ez);
    }
    const items = this.obstacles.items;
    const count = this.obstacles.query(x0 - PAD, z0 - PAD, x1 + PAD, z1 + PAD, this.cand);
    for (let c = 0; c < count && this.hits < MAX_HITS; c++) {
      const i = this.cand[c];
      if (i === self) continue;
      const o = items[i];
      if (!o.solid) continue;
      // project onto the segment the obstacle sits closest to sideways (curves: a neighbouring segment's
      // extension can also "contain" it, at a misleading lateral offset)
      let best = -1;
      let bestLat = Infinity;
      let bestT = 0;
      for (let k = 0; k < this.n; k++) {
        const rx = o.x - this.ax[k];
        const rz = o.z - this.az[k];
        const t = rx * this.dx[k] + rz * this.dz[k];
        const reach = o.circle ? o.hw : o.hl + o.hw;
        if (t < -reach || t > this.len[k] + reach) continue;
        const lat = rx * this.dz[k] - rz * this.dx[k];
        if (Math.abs(lat) < Math.abs(bestLat)) {
          best = k;
          bestLat = lat;
          bestT = t;
          if (Math.abs(lat) < 1) break;
        }
      }
      if (best < 0) continue;
      const along = this.start[best] + bestT;
      if (along <= 0.25) continue;
      const cs = o.fx * this.dx[best] + o.fz * this.dz[best];
      const sn = Math.abs(o.fx * this.dz[best] - o.fz * this.dx[best]);
      const acs = Math.abs(cs);
      const h = this.hits++;
      this.hAlong[h] = along;
      this.hLat[h] = bestLat;
      this.hAcross[h] = o.circle ? o.hw : o.hw * acs + o.hl * sn;
      this.hExt[h] = o.circle ? o.hw : o.hl * acs + o.hw * sn;
      this.hSpeed[h] = Math.max(0, o.speed * cs);
      this.hMargin[h] = MARGIN[o.kind];
      this.hIndex[h] = i;
    }
  }

  /** first gathered obstacle inside a corridor of half width halfW centred `lat` metres left of the route */
  nearest(lat: number, halfW: number, out: AheadHit): AheadHit {
    out.gap = Infinity;
    out.speed = 0;
    out.kind = 'none';
    out.index = -1;
    for (let h = 0; h < this.hits; h++) {
      if (Math.abs(this.hLat[h] - lat) >= halfW + this.hAcross[h] + this.hMargin[h]) continue;
      const gap = this.hAlong[h] - this.hExt[h] - this.halfLen;
      if (gap >= out.gap) continue;
      out.gap = gap;
      out.speed = this.hSpeed[h];
      out.index = this.hIndex[h];
      out.kind = this.obstacles.items[out.index].kind;
    }
    return out;
  }

  /** gather + nearest in one go */
  scan(v: Vehicle, self: number, lat: number, halfW: number, lookahead: number, out: AheadHit): AheadHit {
    this.gather(v, self, lookahead);
    return this.nearest(lat, halfW, out);
  }

  /** the route centreline ahead of v as straight segments (lookahead metres) */
  private buildPath(v: Vehicle, lookahead: number): void {
    this.n = 0;
    let along = 0;
    let track = v.track;
    let s = v.s;
    for (let piece = 0; piece <= v.route.length && along < lookahead; piece++) {
      if (piece > 0) {
        track = v.route[piece - 1];
        s = 0;
      }
      const t = this.tracks.get(track);
      for (let i = this.tracks.segment(t, s); i + 1 < t.pts.length && along < lookahead && this.n < MAX_SEGS; i++) {
        const a = t.pts[i];
        const b = t.pts[i + 1];
        const segLen = t.cum[i + 1] - t.cum[i];
        const from = Math.max(0, s - t.cum[i]);
        if (segLen - from < 1e-6) continue;
        const ux = (b.x - a.x) / segLen;
        const uz = (b.z - a.z) / segLen;
        const k = this.n++;
        this.ax[k] = a.x + ux * from;
        this.az[k] = a.z + uz * from;
        this.dx[k] = ux;
        this.dz[k] = uz;
        // clip at the lookahead: a long next lane must not blow the query box up to its full length
        const use = Math.min(segLen - from, lookahead - along);
        this.len[k] = use;
        this.start[k] = along;
        along += use;
      }
    }
  }
}
