import type { PlayerInput } from '../../core/types';
import { GamepadSource } from './gamepad';
import { emptyFrame, type SourceFrame } from './input-shaping';
import { KeyboardSource } from './keyboard';
import { TouchOverlay } from './touch-overlay';

export type TouchMode = 'auto' | 'on' | 'off';
type Device = PlayerInput['device'];

export interface InputOptions {
  /** where keyboard listeners attach (default window) */
  target?: Window;
  /** parent element for the touch overlay (default document.body) */
  touchParent?: HTMLElement;
  /** 'auto' shows touch controls after the first touch, hides them again on keyboard/gamepad use */
  touch?: TouchMode;
}

const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

/**
 * Keyboard + Gamepad + Touch merged into one PlayerInput per frame. Analog values combine (max / summed steer),
 * edge flags OR together, `device` reports the most recently used device (for prompt glyphs).
 */
export class Input {
  readonly keyboard: KeyboardSource;
  readonly gamepad = new GamepadSource();
  readonly touch: TouchOverlay;
  private device: Device = 'keyboard';
  private touchMode: TouchMode;
  private last = -1;
  private injectedInteract = false;
  private readonly kb: SourceFrame = emptyFrame();
  private readonly gp: SourceFrame = emptyFrame();
  private readonly tc: SourceFrame = emptyFrame();
  private readonly target: Window;

  constructor(opts: InputOptions = {}) {
    this.target = opts.target ?? window;
    this.keyboard = new KeyboardSource(this.target);
    this.touch = new TouchOverlay(opts.touchParent);
    this.touchMode = opts.touch ?? 'auto';
    this.touch.visible = this.touchMode === 'on';
    this.target.addEventListener('pointerdown', this.onPointer, { capture: true });
  }

  /** once per frame: snapshot of all devices (edge flags are true for exactly one poll) */
  poll(): PlayerInput {
    const now = performance.now();
    const dt = this.last < 0 ? 1 / 60 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.keyboard.read(dt, this.kb);
    this.gamepad.read(dt, this.gp);
    this.touch.read(this.tc);
    this.updateDevice();
    const k = this.kb;
    const g = this.gp;
    const t = this.tc;
    const interact = k.interact || g.interact || t.interact || this.injectedInteract;
    this.injectedInteract = false;
    return {
      throttle: Math.max(k.throttle, g.throttle, t.throttle),
      brake: Math.max(k.brake, g.brake, t.brake),
      steer: clamp1(k.steer + g.steer + t.steer),
      tuck: k.tuck || g.tuck || t.tuck,
      hornPressed: k.horn || g.horn || t.horn,
      interactPressed: interact,
      cameraPressed: k.camera || g.camera || t.camera,
      pausePressed: k.pause || g.pause || t.pause,
      anyPressed: k.any || g.any || t.any || interact,
      device: this.device,
    };
  }

  /** `true`/'on' always show, `false`/'off' never, 'auto' = after a touch */
  setTouchControls(mode: boolean | TouchMode): void {
    this.touchMode = mode === true ? 'on' : mode === false ? 'off' : mode;
    this.touch.visible = this.touchMode === 'on' || (this.touchMode === 'auto' && this.device === 'touch');
  }

  get touchVisible(): boolean {
    return this.touch.visible;
  }

  get lastDevice(): Device {
    return this.device;
  }

  /** inject an interact press (e.g. the HUD prompt was tapped) — delivered on the next poll */
  pressInteract(): void {
    this.injectedInteract = true;
  }

  /** drop held keys/buttons (screen changes, pause) */
  reset(): void {
    this.keyboard.clear();
    this.touch.clear();
  }

  dispose(): void {
    this.target.removeEventListener('pointerdown', this.onPointer, { capture: true });
    this.keyboard.dispose();
    this.touch.dispose();
  }

  private updateDevice(): void {
    const times: Array<[Device, number]> = [
      ['keyboard', this.keyboard.lastUsed], ['gamepad', this.gamepad.lastUsed], ['touch', this.touch.lastUsed],
    ];
    let best = this.device;
    let bestT = -1;
    for (const [d, tm] of times) if (tm > bestT) [best, bestT] = [d, tm];
    if (bestT <= 0 || best === this.device) return;
    this.device = best;
    if (this.touchMode === 'auto') this.touch.visible = best === 'touch';
  }

  private readonly onPointer = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    this.touch.lastUsed = performance.now();
    if (this.touchMode === 'auto' && !this.touch.visible) {
      this.device = 'touch';
      this.touch.visible = true;
    }
  };
}
