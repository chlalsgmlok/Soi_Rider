import { type PerspectiveCamera, Vector3 } from 'three';
import { damp } from '../../core/math2d';
import type { Vec2 } from '../../core/types';
import type { Environment } from '../../engine/env/environment';
import type { WeatherState } from '../types';
import { createFxLight, type FxFrame, readFxLight } from './fx-frame';

/** the rider as the FX see it (PlayerState fits) */
export interface FxRider {
  readonly pos: Vec2;
  readonly heading: number;
  readonly speed: number;
}

/** wind 1.0 ≈ this many m/s (rain slant, smog/steam drift) */
export const WIND_MS = 7;
/** fastest camera motion that still stretches the rain (cuts and teleports are ignored) */
const MAX_CAM_SPEED = 30;
const prev = new Vector3();

/**
 * Fills the shared FxFrame once per update: camera pose + smoothed velocity, the focus point FX gather around
 * (the rider, else where the camera looks on the ground), wind vector, pixel scale and the Environment's light.
 */
export class FrameBuilder {
  readonly frame: FxFrame;
  private primed = false;

  constructor(camera: PerspectiveCamera, state: Readonly<WeatherState>, groundHeight: (x: number, z: number) => number) {
    this.frame = {
      dt: 0, time: 0, camera, camPos: new Vector3(), camDir: new Vector3(0, 0, -1), camVel: new Vector3(), focus: new Vector3(),
      ahead: new Vector3(0, 0, 1), wind: new Vector3(), pxPerUnit: 600, state, light: createFxLight(), groundHeight,
    };
  }

  update(dt: number, env: Environment, rider: FxRider | null, pixelRatio: number): FxFrame {
    const f = this.frame;
    f.dt = dt;
    f.time += dt;
    const cam = f.camera;
    cam.updateMatrixWorld();
    prev.copy(f.camPos);
    f.camPos.setFromMatrixPosition(cam.matrixWorld);
    cam.getWorldDirection(f.camDir);
    if (this.primed && dt > 0) {
      prev.subVectors(f.camPos, prev).divideScalar(dt);
      if (prev.length() > MAX_CAM_SPEED) prev.set(0, 0, 0);
      f.camVel.lerp(prev, damp(8, dt));
    }
    this.primed = true;

    if (rider) {
      f.focus.set(rider.pos.x, f.groundHeight(rider.pos.x, rider.pos.z), rider.pos.z);
      const dir = rider.speed < -0.2 ? -1 : 1;
      f.ahead.set(Math.sin(rider.heading) * dir, 0, Math.cos(rider.heading) * dir);
    } else {
      // where the view ray meets the ground (at most 40 m out)
      const g = f.groundHeight(f.camPos.x, f.camPos.z);
      const t = f.camDir.y < -0.05 ? Math.min(40, (f.camPos.y - g) / -f.camDir.y) : 25;
      f.focus.copy(f.camPos).addScaledVector(f.camDir, t);
      f.focus.y = f.groundHeight(f.focus.x, f.focus.z);
      f.ahead.set(f.camDir.x, 0, f.camDir.z);
      if (f.ahead.lengthSq() < 1e-6) f.ahead.set(0, 0, 1);
      f.ahead.normalize();
    }

    const s = f.state;
    f.wind.set(Math.sin(s.windDir), 0, Math.cos(s.windDir)).multiplyScalar(s.wind * WIND_MS);
    const height = (typeof innerHeight === 'number' ? innerHeight : 720) * pixelRatio;
    f.pxPerUnit = height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    readFxLight(env, f.light);
    return f;
  }
}
