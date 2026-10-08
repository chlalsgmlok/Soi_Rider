import type { PedestrianView, Vec2 } from '../../core/types';

export type PedRole = 'walker' | 'vendor' | 'monk';
/** walk = along a strip · path = following a corner link / crossing · wait = at the kerb · stand = vendor */
export type PedMode = 'walk' | 'path' | 'wait' | 'stand';

/**
 * One pedestrian. Public view fields satisfy `PedestrianView`; the rest is walking state plus what the visuals
 * need (role, umbrella, gait phase, arm pose). Pooled — `reset` re-initialises it.
 */
export class Pedestrian implements PedestrianView {
  id = 0;
  readonly pos: Vec2 = { x: 0, z: 0 };
  heading = 0;
  speed = 0;
  radius = 0.3;
  crossing = false;
  /** 0..1, jumps to 1 on a scare and fades */
  startled = 0;
  look = 0;

  alive = false;
  role: PedRole = 'walker';
  umbrella = false;
  mode: PedMode = 'walk';
  strip = 0;
  s = 0;
  /** +1 walks toward s1, −1 toward s0 */
  dir: 1 | -1 = 1;
  /** lateral offset inside the strip (+ = toward the buildings) and its target */
  off = 0;
  offTarget = 0;
  /** personal preferred offset and cruise speed */
  habit = 0;
  cruise = 1.3;
  /** polyline being followed in 'path' mode, distance along it, and where it leads */
  path: Vec2[] = [];
  pathS = 0;
  pathLen = 0;
  nextStrip = 0;
  nextS = 0;
  nextDir: 1 | -1 = 1;
  /** crossing being waited for / used (-1 none), jaywalk flag */
  crossingId = -1;
  jaywalk = false;
  wait = 0;
  /** decision timers */
  thinkTimer = 0;
  avoidTimer = 0;
  /** startle push (m/s) applied on top of walking, and scare cooldown */
  pushX = 0;
  pushZ = 0;
  /** displacement from the walking line caused by pushes (drifts back) */
  dispX = 0;
  dispZ = 0;
  scareCooldown = 0;
  /** accumulated walk distance → gait phase in the view */
  gait = 0;
  /** monks walk in single file behind a leader (id) */
  follow = -1;
  /** vendor: the cart placement index it stands at */
  cart = -1;

  reset(id: number): void {
    this.id = id;
    this.alive = true;
    this.speed = 0;
    this.crossing = false;
    this.startled = 0;
    this.role = 'walker';
    this.umbrella = false;
    this.mode = 'walk';
    this.off = this.offTarget = this.habit = 0;
    this.path = [];
    this.pathS = this.pathLen = 0;
    this.crossingId = -1;
    this.jaywalk = false;
    this.wait = this.thinkTimer = this.avoidTimer = this.pushX = this.pushZ = this.scareCooldown = this.gait = 0;
    this.dispX = this.dispZ = 0;
    this.follow = -1;
    this.cart = -1;
  }

  /** begin following a polyline (corner link or road crossing), continuing on `strip` at s heading `dir` */
  beginPath(path: Vec2[], strip: number, s: number, dir: 1 | -1, crossing: boolean): void {
    this.mode = 'path';
    this.path = path;
    this.pathS = 0;
    let len = 0;
    for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    this.pathLen = len;
    this.nextStrip = strip;
    this.nextS = s;
    this.nextDir = dir;
    this.crossing = crossing;
  }
}
