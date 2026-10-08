import type { PerspectiveCamera } from 'three';
import type { CityQuery, DistrictId, HudState } from '../../core/types';
import { HudFrame, type HudExtras } from '../../mission';
import type { WeatherSystem } from '../../weather';
import { DISTRICTS } from '../../world';
import type { RideStack } from './ride-stack';
import type { SessionRun } from './session-run';

/**
 * PLAY step 9: the full HudState every frame — the mission's part (phase, target, ETA, comfort, passenger, prompt,
 * minimap) + the rider (speed, flags, camera mode) + the live weather + screen projections (target pin, the
 * `( 6 cm )` clearance brackets, the bike anchor for combo popups). Same object every call.
 */
export class HudFeed {
  private readonly frame = new HudFrame();
  private readonly extras: HudExtras;

  constructor(district: DistrictId, private readonly query: CityQuery) {
    this.extras = {
      city: 'Bangkok', district: DISTRICTS[district].label.en, roadName: '', weather: 'clear', rain: 0, cameraMode: 'auto',
      width: 1, height: 1, targetScreen: null,
    };
  }

  build(run: SessionRun, ride: RideStack, weather: WeatherSystem, camera: PerspectiveCamera, width: number, height: number): HudState {
    const s = ride.bike.state;
    const x = this.extras;
    const w = weather.state;
    x.roadName = this.query.roadNameAt(s.pos);
    x.weather = w.kind;
    x.rain = w.rain;
    x.cameraMode = ride.cam.mode;
    x.width = width;
    x.height = height;
    x.targetScreen = run.markers.targetScreen(camera, width, height);
    return this.frame.build(run.mission.hud(), s, ride.clearance.info, camera, x);
  }
}
