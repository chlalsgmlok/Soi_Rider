/**
 * 3D backdrops behind the non-ride screens (src/app wires them to the UI screens). Each is a BackdropScene:
 * construct with its assets preloaded (`X.assetNames()` / `X.create(...)`), `enter(engine)`, `update(dt)` every frame
 * before `engine.render()`, `exit()`, `dispose()`.
 */
export type { BackdropScene } from './backdrop';
export { TitleScene, type TitleSceneOptions } from './title/title-scene';
export { TITLE_CITY, titleCityData, type TitleSite } from './title/title-site';
export { GarageScene, type GarageSceneOptions } from './garage/garage-scene';
export { IntroScene, type IntroSceneOptions } from './intro/intro-scene';
export type { StandSite } from './intro/stand-site';
export type { StreetLifeParts } from './shared/street-life';
