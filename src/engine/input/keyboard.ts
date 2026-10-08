import { rampToward, type SourceFrame } from './input-shaping';

type Edge = 'horn' | 'interact' | 'camera' | 'pause';

const EDGE_KEYS: Record<string, Edge> = {
  KeyH: 'horn', KeyQ: 'horn', KeyE: 'interact', KeyC: 'camera', Escape: 'pause', KeyP: 'pause',
};
const HELD = new Set(['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'Space']);
/** keys whose browser default (page scroll) must be suppressed */
const NO_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/** time to reach full steering lock with a key, and to return to centre */
export const KEY_STEER_RAMP = 0.15;
export const KEY_STEER_RELEASE = 0.09;

function typingInto(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

/** WASD/arrows + action keys. Edge flags ignore auto-repeat; steering ramps so taps give partial lock. */
export class KeyboardSource {
  lastUsed = 0;
  private readonly down = new Set<string>();
  private readonly edges = new Set<Edge>();
  private anyEdge = false;
  private steer = 0;

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.clear);
  }

  /** fill `out` for this frame (dt in seconds) */
  read(dt: number, out: SourceFrame): void {
    const k = this.down;
    const left = k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0;
    const right = k.has('KeyD') || k.has('ArrowRight') ? 1 : 0;
    this.steer = rampToward(this.steer, right - left, dt, KEY_STEER_RAMP, KEY_STEER_RELEASE);
    out.throttle = k.has('KeyW') || k.has('ArrowUp') ? 1 : 0;
    out.brake = k.has('KeyS') || k.has('ArrowDown') ? 1 : 0;
    out.steer = this.steer;
    out.tuck = k.has('Space');
    out.horn = this.edges.has('horn');
    out.interact = this.edges.has('interact');
    out.camera = this.edges.has('camera');
    out.pause = this.edges.has('pause');
    out.any = this.anyEdge;
    out.active = this.anyEdge || k.size > 0;
    this.edges.clear();
    this.anyEdge = false;
  }

  readonly clear = (): void => {
    this.down.clear();
    this.edges.clear();
    this.anyEdge = false;
    this.steer = 0;
  };

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.clear);
  }

  private readonly onDown = (e: KeyboardEvent): void => {
    if (typingInto(e.target)) return;
    if (NO_DEFAULT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.lastUsed = performance.now();
    this.anyEdge = true;
    if (HELD.has(e.code)) this.down.add(e.code);
    const edge = EDGE_KEYS[e.code];
    if (edge) this.edges.add(edge);
  };

  private readonly onUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };
}
