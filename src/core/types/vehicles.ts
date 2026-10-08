import type { OBB, Vec2 } from './geometry';

export type VehicleKind = 'taxi' | 'sedan' | 'van' | 'pickup' | 'tuktuk' | 'bus' | 'songthaew' | 'moto';

export interface VehicleSpec {
  kind: VehicleKind;
  /** GLB name in public/assets/models (without extension) */
  model: string;
  length: number;
  width: number;
  /** total width including mirrors (0 = no mirror hitboxes) */
  mirrorSpan: number;
  /** mirror position along forward axis from centre (m, + = toward front) */
  mirrorZ: number;
  /** mirror height above ground (m) — used by the clearance indicator */
  mirrorY: number;
  maxSpeed: number;
  accel: number;
  decel: number;
  /** palette hex values for the `Paint` material; [paint, paint2] pairs for two-tone */
  paints: Array<[string, string]>;
  /** spawn weight per traffic intensity */
  weight: number;
}

/** What other systems may read about an NPC vehicle (implemented by src/traffic). */
export interface TrafficAgentView {
  readonly id: number;
  readonly kind: VehicleKind;
  readonly spec: VehicleSpec;
  readonly pos: Vec2;
  readonly heading: number;
  readonly speed: number;
  readonly obb: OBB;
  /** 0 or 2 thin boxes (left, right) at mirror height */
  readonly mirrors: readonly OBB[];
  readonly braking: boolean;
  /** -1 left, 0 none, +1 right */
  readonly indicator: -1 | 0 | 1;
  readonly honking: boolean;
  readonly paint: string;
  readonly paint2: string;
  /** deterministic seed for rider look (motos) / driver */
  readonly look: number;
  /** current lane id or -1 when on a connector / free (motos) */
  readonly laneId: number;
  /** true when it went from moving to stopped in a queue */
  readonly queued: boolean;
}

export type SignalPhase = 'ns_green' | 'ns_yellow' | 'ew_green' | 'ew_yellow' | 'all_red';

export interface SignalView {
  node: number;
  phase: SignalPhase;
  /** seconds left in this phase */
  remaining: number;
}

/** Pedestrians are owned by src/traffic/pedestrians.ts */
export interface PedestrianView {
  readonly id: number;
  readonly pos: Vec2;
  readonly heading: number;
  readonly speed: number;
  readonly radius: number;
  readonly crossing: boolean;
  readonly startled: number;
  readonly look: number;
}

export interface TrafficQuery {
  agents(): readonly TrafficAgentView[];
  /** fills `out` with agents whose centre is within r of p, returns count */
  near(p: Vec2, r: number, out: TrafficAgentView[]): number;
  pedestrians(): readonly PedestrianView[];
  signal(nodeId: number): SignalView | null;
  /** apply a shove to an NPC moto/pedestrian after contact */
  nudge(id: number, impulse: Vec2): void;
}
