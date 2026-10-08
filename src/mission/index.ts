/** Mission module public API (docs/ARCHITECTURE.md › mission): job flow, gram navigation, route line + markers. */
export { Navigator, type NavPose, type NavTarget } from './nav/navigator';
export { RoutePath, type PathProjection } from './nav/route-path';
export { searchLanes, LANE_CHANGE_PENALTY, type LanePoint, type LaneRoute, type RouteStep } from './nav/lane-search';
export { buildLaneGroups, carriageway, type LaneGroups } from './nav/lane-groups';
export { startPoint, laneOffsetOf } from './nav/start-lane';
export { RerouteWatch, OFF_ROUTE_M, WRONG_WAY_SEC, REROUTE_GAP } from './nav/reroute-watch';

export { MissionController } from './run/mission-controller';
export type { MissionFrame, MissionHooks, MissionOptions, MissionView, MissionWeather } from './run/mission-types';
export { MissionHudBuilder, createMissionHud, type MissionHud } from './run/mission-hud';
export {
  PhaseFlow, STOP_RADIUS, STOP_SPEED, STOP_HOLD, BOARD_SEC, DROP_SEC, ARRIVE_METERS, type FlowStep,
} from './run/phase-flow';
export { StoryPrompts, PROMPT_WINDOW, type CareId, type PromptEvent } from './run/story-prompts';
export { RedLightWatch, type SignalLookup } from './run/red-light-watch';
export { WeatherWatch } from './run/weather-watch';
export { INNER_RING, SMOOTH_ZONE } from './run/smooth-arrival';

export { RouteLine } from './view/route-line';
export type { GroundFn } from './view/route-ribbon';
export { MissionMarkers, type MarkerSource } from './view/mission-markers';
export { TargetPin } from './view/target-pin';
export { WaitingPassenger } from './view/waiting-passenger';
export { DestFlag } from './view/dest-flag';
export { curbSpot, type CurbSpot } from './view/curb-spot';

/** dev helpers the app's ?bot=1 / QA modes may reuse */
export { RouteBot, holdInput, type BotCommand, type BotMission } from './dev/route-bot';
export { HudFrame, type HudExtras } from './dev/hud-frame';
