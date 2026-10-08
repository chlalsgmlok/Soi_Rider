import { axisDeadzone, curve, radialDeadzone, rampToward, type SourceFrame } from './input-shaping';

/** standard-mapping button indices */
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, LEFT: 14, RIGHT: 15 } as const;

export const STICK_DEADZONE = 0.16;
export const TRIGGER_DEADZONE = 0.06;

/** Gamepad API source (standard mapping): RT/LT throttle/brake, left stick steer, RB tuck, X horn, A interact, Y camera, Start pause. */
export class GamepadSource {
  lastUsed = 0;
  connected = false;
  private prev: boolean[] = [];
  private padSteer = 0;

  read(dt: number, out: SourceFrame): void {
    const pad = this.pick();
    this.connected = pad !== null;
    if (!pad) {
      out.throttle = out.brake = out.steer = 0;
      out.tuck = out.horn = out.interact = out.camera = out.pause = out.any = out.active = false;
      this.prev = [];
      return;
    }
    const b = pad.buttons;
    const val = (i: number): number => b[i]?.value ?? 0;
    const pressed = (i: number): boolean => b[i]?.pressed ?? false;
    const edge = (i: number): boolean => pressed(i) && !this.prev[i];

    const [sx] = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, STICK_DEADZONE);
    const dpad = (pressed(BTN.RIGHT) ? 1 : 0) - (pressed(BTN.LEFT) ? 1 : 0);
    this.padSteer = rampToward(this.padSteer, dpad, dt, 0.15, 0.09);
    out.steer = sx !== 0 ? curve(sx, 1.35) : this.padSteer;
    out.throttle = axisDeadzone(val(BTN.RT), TRIGGER_DEADZONE);
    out.brake = axisDeadzone(val(BTN.LT), TRIGGER_DEADZONE);
    out.tuck = pressed(BTN.RB);
    out.horn = edge(BTN.X);
    out.interact = edge(BTN.A);
    out.camera = edge(BTN.Y);
    out.pause = edge(BTN.START);

    let anyEdge = false;
    for (let i = 0; i < b.length; i++) if (edge(i)) anyEdge = true;
    out.any = anyEdge;
    out.active = anyEdge || sx !== 0 || out.throttle > 0 || out.brake > 0 || dpad !== 0 || out.tuck;
    if (out.active) this.lastUsed = performance.now();
    this.prev = b.map((x) => x.pressed);
  }

  /** first connected pad, preferring the standard mapping */
  private pick(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    let fallback: Gamepad | null = null;
    for (const p of navigator.getGamepads()) {
      if (!p || !p.connected) continue;
      if (p.mapping === 'standard') return p;
      fallback ??= p;
    }
    return fallback;
  }
}
