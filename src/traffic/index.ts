/**
 * Traffic module public API (docs/ARCHITECTURE.md): the simulation (TrafficSystem implements TrafficQuery), its
 * visuals (TrafficView) and the camera-based ViewProbe the spawner uses to stay off screen.
 */
export { TrafficSystem } from './traffic-system';
export { capsFor, motoBudget, type TrafficOptions } from './traffic-options';
export { TrafficView, type TrafficViewFrame, type TrafficViewOptions, type TrafficViewStats } from './view/traffic-view';
export { trafficAssetNames } from './view/rig-set';
export { CameraProbe } from './view/camera-probe';
export { npcIdOf } from './view/mirror-folds';
export { lampFor, lampForPhase, type LampState } from './sim/signal-plan';
export { approachGroup } from './sim/signals';
export {
  PED_ID_BASE, type ExhaustPuff, type PedScare, type TrafficCaps, type TrafficConditions, type TrafficPlayer,
  type TrafficStats, type ViewProbe,
} from './sim/types';
