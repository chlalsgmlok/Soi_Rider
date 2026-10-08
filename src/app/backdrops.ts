import type { Loadout, TimeOfDay } from '../core/types';
import type { AssetProgress, Assets, Engine } from '../engine';
import { type BackdropScene, GarageScene, TitleScene } from './scenes';

/**
 * The menu backdrops (title diorama, garage turntable): built once, kept for quick returns, and whichever 3D
 * backdrop is on screen (`show` exits the previous one; the intro's backdrop passes through here too).
 */
export class Backdrops {
  title: TitleScene | null = null;
  garage: GarageScene | null = null;
  private active: BackdropScene | null = null;

  constructor(private readonly engine: Engine, private readonly assets: Assets) {}

  get current(): BackdropScene | null {
    return this.active;
  }

  async loadTitle(loadout: Loadout, reducedMotion: boolean, onProgress?: AssetProgress): Promise<TitleScene> {
    this.title ??= await TitleScene.create(this.engine, this.assets, { loadout, timeOfDay: 'sunset', reducedMotion }, onProgress);
    return this.title;
  }

  async loadGarage(loadout: Loadout, reducedMotion: boolean): Promise<GarageScene> {
    this.garage ??= await GarageScene.create(this.engine, this.assets, { loadout, reducedMotion });
    return this.garage;
  }

  /** make `scene` the visible backdrop */
  show(scene: BackdropScene): void {
    if (this.active === scene) return;
    this.active?.exit();
    this.active = scene;
    scene.enter(this.engine);
  }

  /** no menu backdrop (the run owns the screen) */
  hide(): void {
    this.active?.exit();
    this.active = null;
  }

  /** the equipped look changed: the title hero and the garage rider wear it */
  setLoadout(loadout: Loadout): void {
    this.title?.setLoadout(loadout);
    this.garage?.applyLoadout(loadout);
  }

  /** the title follows the last trip's light */
  setTitleTime(tod: TimeOfDay): void {
    this.title?.setTimeOfDay(tod, 0);
  }

  setReducedMotion(on: boolean): void {
    if (this.title) this.title.reducedMotion = on;
    if (this.garage) this.garage.reducedMotion = on;
  }

  dispose(): void {
    this.hide();
    this.title?.dispose();
    this.garage?.dispose();
    this.title = this.garage = null;
  }
}
