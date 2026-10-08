/** Player module public API (docs/ARCHITECTURE.md › player). */
export { BikePhysics, type RideInput } from './bike-physics';
export { createPlayerState, gripFor, laneStatus, FLAT_ENV, type RideEnv } from './ride-env';
export { maxSteerAt, steerToward, gripYaw, STEER_TIME, STEER_TIME_TUCK } from './ride-steering';
export { brakeLimit, drive, forwardAccel, resistance, speedCap } from './ride-longitudinal';
export { updateHull, MIRROR_BOX_L, MIRROR_BOX_W } from './ride-hull';
export { FallMotion, FALL_LEAN, GETUP_TIME, fallSide } from './fall-motion';
export { RideAnnouncer } from './ride-announcer';
export { Spring } from './spring';
export { RiderRig, type RigFrame, type RigPose } from './rig/rider-rig';
export { PassengerRig, SPARE_HELMET } from './rig/passenger';
export { BoardingTimeline, type BoardingFrame, type BoardingKind } from './rig/boarding';
export { RIDER_LOOK } from './rig/loadout';
export { riderRigAssetNames } from './rig/rig-assets';
export { headLook } from './rig/head-look';
export { PovCockpit } from './cockpit/pov-cockpit';
export { DashScreen } from './cockpit/dash-screen';
export { mergeParts, releasePart } from './rig/merge-parts';
