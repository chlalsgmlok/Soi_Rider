import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { PALETTE } from '../../core/config/palette';
import { VEHICLES } from '../../core/config/traffic';
import { headingOf } from '../../core/math2d';
import type { CityQuery, Lane, Vec2 } from '../../core/types';
import type { TrafficPlayer } from '../sim/types';
import { Vehicle } from '../sim/vehicle';

export type MarkerMode = 'kerb' | 'road';

export interface MarkerSpot {
  pos: Vec2;
  heading: number;
  /** where the diorama camera looks (the middle of the approach's carriageway) */
  focus: Vec2;
  /** the junction ahead and the approach road (signal lamp lookups) */
  node: number;
  edge: number;
}

/** inbound carriageway (lanes sorted inner → curb) of a busy signalised junction away from the city edge */
function approach(city: CityQuery, back: number): Lane[] {
  const { nodes, lanes, edges, bounds } = city.data;
  const inside = (p: Vec2, m: number): boolean => p.x > bounds.minX + m && p.x < bounds.maxX - m && p.z > bounds.minZ + m && p.z < bounds.maxZ - m;
  const groups = new Map<string, Lane[]>();
  for (const l of lanes) {
    const e = edges[l.edge];
    const n = nodes[l.forward ? e.b : e.a];
    if (!n.signal || l.length < back + 6 || !inside(n.pos, 60) || !inside(l.start, 70)) continue;
    const key = `${l.edge}:${l.forward}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  const score = (g: Lane[]): number => (edges[g[0].edge].cls === 'main' ? 10 : 0) + g.length;
  const best = [...groups.values()].sort((a, b) => score(b) - score(a))[0];
  return best ? best.sort((a, b) => a.index - b.index) : [lanes[0]];
}

/**
 * Where the sandbox parks the rider: `back` metres before the stop line of a busy junction (the queue builds up
 * ahead of the camera), up on the kerb beside the curb lane ('kerb', traffic flows past) or in the curb-lane gutter
 * ('road', NPCs must brake and honk).
 */
export function pickSpot(city: CityQuery, mode: MarkerMode, back = 20): MarkerSpot {
  const group = approach(city, back);
  const curb = group[group.length - 1];
  const inner = group[0];
  const s = Math.max(4, curb.length - back);
  const at = (l: Lane, lat: number): Vec2 => ({
    x: l.start.x + l.dir.x * s + l.dir.z * lat, z: l.start.z + l.dir.z * s - l.dir.x * lat,
  });
  const lat = mode === 'kerb' ? curb.width / 2 + 0.75 : curb.width / 2 - 0.42;
  const a = at(curb, 0);
  const b = at(inner, 0);
  const e = city.data.edges[curb.edge];
  return {
    pos: at(curb, lat), heading: headingOf(curb.dir), focus: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
    node: curb.forward ? e.b : e.a, edge: e.id,
  };
}

/** The stationary rider: an NPC-style motorbike drawn by the traffic view, its hull, and the cyan gram ring. */
export class Marker {
  readonly vehicle = new Vehicle();
  readonly ring: Mesh;
  readonly player: TrafficPlayer;

  constructor(spot: MarkerSpot) {
    const v = this.vehicle;
    v.reset(-1, VEHICLES.moto, true);
    v.paint = PALETTE.gramCyan;
    v.paint2 = PALETTE.ink;
    v.look = 0x1f3a8;
    v.setPose(spot.pos.x, spot.pos.z, spot.heading, spot.heading);
    this.player = { pos: v.pos, heading: spot.heading, speed: 0, obb: v.obb };
    const g = new RingGeometry(0.78, 0.92, 48);
    g.rotateX(-Math.PI / 2);
    const m = new MeshBasicMaterial({ color: PALETTE.gramCyan, transparent: true, opacity: 0.9, side: DoubleSide, toneMapped: false });
    m.color.multiplyScalar(1.6);
    this.ring = new Mesh(g, m);
    this.ring.name = 'gram_ring';
    this.ring.position.set(spot.pos.x, 0.18, spot.pos.z);
    this.ring.renderOrder = 3;
  }

  dispose(): void {
    this.ring.removeFromParent();
    this.ring.geometry.dispose();
    (this.ring.material as MeshBasicMaterial).dispose();
  }
}
