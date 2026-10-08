import type { CollisionKind } from '../core/events';
import type { BikeStats, CityQuery, PlayerState, Vec2 } from '../core/types';

/** One contact that started this step (persisting contacts are not re-reported while they last). */
export interface ContactReport {
  kind: CollisionKind;
  /** relative closing speed exceeded RIDE.fallSpeedKmh → the rider falls */
  heavy: boolean;
  /** relative speed at the contact (km/h) */
  speedKmh: number;
  point: Vec2;
  /** NPC agent / pedestrian / static collider id; −1 for curbs */
  otherId: number;
  /** obstacle key unique across sources (see ObstacleScan: agent id, 1e6 + static id, 2e6 + pedestrian id); −1 for curbs */
  key: number;
  /** label for GameEvents.collision.other, e.g. "taxi#12", "pole#40", "pedestrian#3", "curb" */
  other: string;
}

/** What the sensors read from the rider. */
export interface SensedRider {
  readonly state: PlayerState;
  readonly stats: BikeStats;
}

/** Planar contact response parameters (see BikePhysics.collide). */
export interface ContactResponse {
  /** 0 = plastic, 1 = elastic bounce along the normal */
  restitution: number;
  /** extra fraction of the remaining speed lost (0..1) */
  speedLoss: number;
  /** 0..1 how strongly the heading is turned toward the deflected direction */
  yawKick: number;
}

/** What collision resolution may do to the rider (implemented by player/BikePhysics). */
export interface CollisionBody extends SensedRider {
  /** move the rider; hull boxes follow */
  displace(dx: number, dz: number): void;
  /** velocity response to a contact whose unit normal (nx, nz) points away from the obstacle */
  collide(nx: number, nz: number, r: ContactResponse): void;
  /** lose this fraction (0..1) of the current speed (curb steps, scrubbing) */
  slow(fraction: number): void;
  /** vertical bounce impulse (m/s, + = up) */
  impulse(v: number): void;
  fall(reason: string): void;
}

/** The part of CityQuery the physics needs — a full CityQuery satisfies it; sandboxes can provide a light one. */
export type CollisionWorld = Pick<CityQuery, 'surfaceAt' | 'staticNear'>;

/** rider silhouette height (helmet top) for height-aware contacts */
export const RIDER_TOP = 1.75;
/** half height of a mirror head */
export const MIRROR_HALF_H = 0.08;
/** obstacles farther than this from the bike centre are ignored by all sensors */
export const SENSE_RADIUS = 7;
