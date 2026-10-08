/** Chips stacked above the gauge: combo counter, tuck indicator, camera-mode hint (shown briefly after a change). */
import type { HudState } from '../../core/types/hud';
import type { CameraMode } from '../../core/types/save';
import type { HudWidget } from './types';
import { h } from '../core/h';
import { icon } from '../icons/icon';
import { bump } from '../core/animate';
import { CAMERA_LABEL } from './labels';

const CAM_HINT_MS = 2200;

export class RiderStatus implements HudWidget {
  readonly el: HTMLElement;
  private comboNum = h('span', '×2');
  private combo = h('div.hud-combo.is-off', h('small', 'COMBO'), this.comboNum);
  private tuck = h('span.chip.chip--warn.chip--sm.hud-tuck.is-off', icon('tuck', 13), h('span', '움츠리기 · 15 km/h'));
  private camText = h('span', '');
  private cam = h('span.chip.chip--sm.hud-cam.is-off', h('span.keycap.keycap--sm', 'C'), icon('camera', 13), this.camText);
  private lastCombo = 0;
  private tucking = false;
  private camMode: CameraMode | null = null;
  private camUntil = 0;

  constructor() {
    this.el = h('div.hud-status', { style: { display: 'contents' } }, this.cam, this.combo, this.tuck);
  }

  update(s: HudState, now: number): void {
    if (s.combo !== this.lastCombo) {
      const up = s.combo > this.lastCombo;
      this.lastCombo = s.combo;
      const on = s.combo >= 2;
      this.combo.classList.toggle('is-off', !on);
      if (on) {
        this.comboNum.textContent = `×${s.combo}`;
        if (up) bump(this.combo, 0.3);
      }
    }
    if (s.tucking !== this.tucking) {
      this.tucking = s.tucking;
      this.tuck.classList.toggle('is-off', !s.tucking);
    }
    if (s.cameraMode !== this.camMode) {
      const first = this.camMode === null;
      this.camMode = s.cameraMode;
      this.camText.textContent = `카메라 · ${CAMERA_LABEL[s.cameraMode]}`;
      if (!first) {
        this.camUntil = now + CAM_HINT_MS;
        this.cam.classList.remove('is-off');
      }
    }
    if (this.camUntil && now > this.camUntil) {
      this.camUntil = 0;
      this.cam.classList.add('is-off');
    }
  }
}
