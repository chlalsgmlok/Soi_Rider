import { Group } from 'three';
import { type Loadout, Surface, type Vec2 } from '../../../core/types';
import type { Assets } from '../../../engine/assets/assets';
import type { QualitySettings } from '../../../engine/quality';
import { GramRing } from '../shared/gram-ring';
import { IdleRider } from '../shared/idle-rider';

/** The title's hero: the player's rider waiting on the kerb, online in gram — inside the pulsing cyan ring. */
export class TitleHero {
  readonly root = new Group();
  private readonly rider: IdleRider;
  private readonly ring = new GramRing();

  /** `kerb` = pavement height at `pos` */
  constructor(assets: Assets, loadout: Loadout, quality: QualitySettings, pos: Vec2, heading: number, kerb: number) {
    this.root.name = 'title_hero';
    this.rider = new IdleRider(assets, loadout, quality);
    this.rider.place(pos, heading, Surface.Sidewalk, kerb);
    this.ring.root.position.set(pos.x, kerb, pos.z);
    this.root.add(this.rider.root, this.ring.root);
  }

  /** the parked bike as the traffic simulation sees it (NPCs and pedestrians keep clear) */
  get state(): IdleRider['state'] {
    return this.rider.state;
  }

  setLoadout(loadout: Loadout): void {
    this.rider.setLoadout(loadout);
  }

  setQuality(q: QualitySettings): void {
    this.rider.rig.setQuality(q);
  }

  update(dt: number, lamps: number, night: number, still: boolean): void {
    this.rider.update(dt, lamps, night);
    this.ring.update(dt, still);
  }

  dispose(): void {
    this.rider.dispose();
    this.ring.dispose();
    this.root.removeFromParent();
  }
}
