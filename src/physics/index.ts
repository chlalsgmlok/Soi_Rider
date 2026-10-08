/** Physics module public API (docs/ARCHITECTURE.md › physics). */
export { obbOverlap, obbCircleOverlap, contactPointObb, contactPointCircle, newPenetration, type Penetration } from './sat';
export { obbGap, obbCircleGap, newGapPoints, type GapPoints } from './obb-gap';
export { closestOnObb, obbCorner, obbRadiusOn, pointInObb, toObbLocal, fromObbLocal, type ObbLocal } from './obb-math';
export { SpatialHash } from './spatial-hash';
export { CollisionSystem } from './collision-system';
export { CurbDetector, CURB_HEIGHT, isRaised } from './curb-detector';
export { RESPONSES, type KindResponse } from './contact-responses';
export {
  type CollisionBody, type CollisionWorld, type ContactReport, type ContactResponse, type SensedRider,
  RIDER_TOP, MIRROR_HALF_H, SENSE_RADIUS,
} from './collision-types';
export { VEHICLE_HEIGHTS, STATIC_HEIGHTS, PEDESTRIAN_HEIGHT, type HeightProfile } from './body-heights';
export { ObstacleScan, STATIC_KEY, PED_KEY, type ObstaclePart, type PartSource } from './obstacle-scan';
export { ClearanceSensor, CLEARANCE_RANGE, CLEARANCE_WINDOW, type ClearanceSample } from './clearance-sensor';
export { StyleSensor, type ClearanceFeed } from './style-sensor';
export { FilterPassTracker } from './filter-pass';
export { type StyleEvent, NEAR_MISS_GAP, NEAR_MISS_KMH, PERFECT_GAP, PERFECT_GAP_KMH } from './style-events';
export { publishStyle, tickStyle, breakStyle } from './style-publish';
export { RiderPieces, BIKE_TOP, type RiderPiece } from './rider-pieces';
export { shapeAtBand, type BandShape } from './part-shape';
export { StaticTraffic, type StaticAgent, type StaticPedestrian } from './testing/static-traffic';
export { agentHull, NPC_MIRROR_L, NPC_MIRROR_W } from './testing/agent-hull';
