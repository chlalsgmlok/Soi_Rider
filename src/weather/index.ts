/** Weather module public API (docs/ARCHITECTURE.md › weather). */
export { WeatherSystem, type WeatherCity, type WeatherCtx, type WeatherRider } from './weather-system';
export { WeatherTimeline, BASE_LEVELS, SPIKE_HAZE, WASHOUT } from './timeline/weather-timeline';
export { DOWNPOUR_SHAPE, HAZE_SHAPE, downpourAt, hazeSpikeAt, taperSec } from './timeline/envelopes';
export { AFTERMATH, stepWetness, stepWashout, wetTarget } from './timeline/rain-aftermath';
export { flashAt, THUNDER } from './timeline/thunder-clock';
export { createWeatherState, type WeatherPhase, type WeatherState, type Strike } from './types';
export { fxBudget, type FxBudget } from './fx/fx-budget';
export { WIND_MS, type FxRider } from './fx/frame-builder';
export { RainFx } from './fx/rain/rain-fx';
export { HazeFx } from './fx/haze/haze-fx';
export { Spray, type SpraySource } from './fx/rain/spray';
export { PuddleSplash, SPLASH_REACH, SPLASH_SPEED, SPLASH_WETNESS, type SplashRider } from './fx/rain/puddle-splash';
export { WetGloss } from './fx/wet/wet-gloss';
export { WetReflections } from './fx/wet/wet-reflections';
