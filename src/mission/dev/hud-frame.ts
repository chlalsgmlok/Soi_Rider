import { type Camera, Vector3 } from 'three';
import { KMH } from '../../core/math2d';
import { Surface, type CameraMode, type ClearanceInfo, type HudState, type PlayerState, type ScreenPoint, type Vec2, type WeatherKind } from '../../core/types';
import type { MissionHud } from '../run/mission-hud';

/** brackets show below this gap (m) — docs/GAME_DESIGN.md §12 */
const TIGHT = 0.3;
/** anchor height of the clearance brackets (mirror height, m) */
const MIRROR_Y = 1.05;

export interface HudExtras {
  city: string;
  district: string;
  roadName: string;
  weather: WeatherKind;
  rain: number;
  cameraMode: CameraMode;
  width: number;
  height: number;
  targetScreen: ScreenPoint | null;
}

/**
 * Dev assembly of the full HudState for the mission sandbox: the mission's part (MissionController.hud()) plus the
 * rider (speed, flags), clearance brackets and the bike anchor projected to CSS pixels. The app builds the same.
 */
export class HudFrame {
  private readonly v = new Vector3();
  private state: HudState | null = null;

  build(m: MissionHud, s: PlayerState, c: ClearanceInfo, camera: Camera, x: HudExtras): HudState {
    const st = this.state ?? (this.state = {
      ...m, city: x.city, district: x.district, roadName: '', targetScreen: null, speedKmh: 0, weather: 'clear', rain: 0,
      cameraMode: 'auto', counterflow: false, onSidewalk: false, tucking: false, bikeScreen: null,
      clearance: { leftCm: null, rightCm: null, leftScreen: null, rightScreen: null },
    });
    Object.assign(st, m);
    st.roadName = x.roadName;
    st.targetScreen = x.targetScreen;
    st.speedKmh = Math.abs(s.speed) * KMH;
    st.weather = x.weather;
    st.rain = x.rain;
    st.cameraMode = x.cameraMode;
    st.counterflow = s.counterflow;
    st.onSidewalk = s.surface === Surface.Sidewalk;
    st.tucking = s.tuck;
    const cl = st.clearance;
    cl.leftCm = c.left < TIGHT ? Math.round(c.left * 100) : null;
    cl.rightCm = c.right < TIGHT ? Math.round(c.right * 100) : null;
    cl.leftScreen = cl.leftCm !== null && c.leftPoint ? this.project(c.leftPoint, MIRROR_Y, camera, x) : null;
    cl.rightScreen = cl.rightCm !== null && c.rightPoint ? this.project(c.rightPoint, MIRROR_Y, camera, x) : null;
    st.bikeScreen = this.project(s.pos, 1.2, camera, x);
    return st;
  }

  private project(p: Vec2, y: number, camera: Camera, x: HudExtras): ScreenPoint | null {
    const v = this.v.set(p.x, y, p.z).project(camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * x.width, y: ((1 - v.y) / 2) * x.height };
  }
}
