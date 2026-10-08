/** Camera module public API (docs/ARCHITECTURE.md › camera). */
export { CameraRig } from './camera-rig';
export { AutoSqueeze, EXIT_GAP, EXIT_KMH } from './auto-squeeze';
export { CameraClip, type CameraWorld } from './camera-clip';
export { CameraShake } from './camera-shake';
export { EventShot, FALL_SLOWMO, FALL_TIMESCALE, type EventShotKind } from './event-shot';
export { applyPose, blendPose, copyPose, newPose, screenY, type CameraPost, type CamPose } from './camera-pose';
export { dioramaPose, squeezePose, povPose, DIORAMA_YAW, type FrameInput } from './framings';
export { orbitPose, type OrbitOptions } from './orbit';
