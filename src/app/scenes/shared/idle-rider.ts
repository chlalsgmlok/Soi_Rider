import { BIKES } from '../../../core/config/bikes';
import type { Loadout, PlayerState, SurfaceKind, Vec2 } from '../../../core/types';
import type { Assets } from '../../../engine/assets/assets';
import type { QualitySettings } from '../../../engine/quality';
import { createPlayerState, RiderRig, updateHull } from '../../../player';

/** slow look-around of a waiting rider in steer units (bars + head): holds straight, glances one way, then the other */
export function glance(t: number): number {
  const s = Math.sin(t * 0.42);
  return 0.34 * s * s * s;
}

/**
 * The player's RiderRig waiting on its bike (feet down, glancing around) at a fixed spot — title kerb, garage
 * turntable, intro win stand. Owns the PlayerState that drives the rig; that state doubles as the TrafficPlayer so
 * NPCs and pedestrians keep clear of the parked bike. Pass an existing rig (the session's) to borrow it instead.
 */
export class IdleRider {
  readonly rig: RiderRig;
  readonly state: PlayerState;
  /** ground height the rig stands on (sidewalk, turntable top) */
  groundY = 0;
  /** extra lift on top of groundY (equip hop) */
  lift = 0;
  /** glance around (off = look straight ahead) */
  lookAround = true;
  private readonly owned: boolean;
  private bike: Loadout['bike'];
  private t = 0;

  constructor(assets: Assets, loadout: Loadout, quality: QualitySettings, rig?: RiderRig) {
    this.owned = !rig;
    this.rig = rig ?? new RiderRig(assets, loadout, quality);
    this.bike = loadout.bike;
    this.state = createPlayerState(BIKES[loadout.bike]);
    this.state.feetDown = true;
  }

  get root(): RiderRig['root'] {
    return this.rig.root;
  }

  /** park at a pose; `ground` = visual height under the wheels */
  place(pos: Vec2, heading: number, surface: SurfaceKind, ground: number): void {
    const s = this.state;
    s.pos.x = pos.x;
    s.pos.z = pos.z;
    s.heading = heading;
    s.surface = surface;
    this.groundY = ground;
    updateHull(s, BIKES[this.bike], 0);
  }

  /** turn in place (garage turntable) */
  setHeading(heading: number): void {
    this.state.heading = heading;
    updateHull(this.state, BIKES[this.bike], 0);
  }

  setLoadout(l: Loadout): void {
    this.rig.applyLoadout(l);
    this.bike = l.bike;
    updateHull(this.state, BIKES[l.bike], 0);
  }

  /** lamps / night from the Environment (head + tail lamps, headlight pool) */
  update(dt: number, lamps: number, night: number): void {
    this.t += dt;
    const steer = this.lookAround ? glance(this.t) : 0;
    this.rig.update(dt, this.state, { steer, lamps, night, groundY: this.groundY + this.lift });
  }

  /** disposes the rig only if this rider built it (a borrowed rig stays with its owner) */
  dispose(): void {
    if (this.owned) this.rig.dispose();
  }
}
