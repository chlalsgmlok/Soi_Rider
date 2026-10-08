/** City scene building (src/world/build) — public API. */
export { buildCityView } from './city-view';
export { cityAssetNames, preloadCityFonts } from './asset-list';
export { CityHeights } from './heights';
export { HEIGHTS, BIKE_BOX_DEPTH, EXIT_EXTENSION } from './kit/dims';
export { signalAspect, approachAxis, type SignalAspect } from './lights/signal-phase';
export type { CityFrame, CityView, CityViewCtx, CityViewStats, SpeedBump } from './types';
