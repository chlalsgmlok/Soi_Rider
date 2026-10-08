import { type Object3D, Vector3 } from 'three';
import type { PassengerProfile, PlayerState } from '../../core/types';
import type { Assets } from '../../engine/assets/assets';
import { BoardingTimeline, type BoardingKind } from './boarding';
import { PassengerRig } from './passenger';

/**
 * The pillion seat: owns the PassengerRig, runs boarding / dismount timelines (with the spare-helmet hand-over
 * between the rider's left hand and the passenger's head) and otherwise keeps the passenger seated.
 */
export class PassengerSlot {
  rig: PassengerRig | null = null;
  private timeline: BoardingTimeline | null = null;
  private resolve: (() => void) | null = null;
  private readonly care = { poncho: false, mask: false };
  /** ground-level parent while the bike is down (null = on the pillion) */
  private spilled: Object3D | null = null;
  private spillSide = 1;
  /** cushion / backrest / throne raise the passenger above the bike's seat_pillion (m) */
  private lift = 0;
  private readonly lifted = new Vector3();

  constructor(private readonly assets: Assets, private readonly content: Object3D) {}

  /** a scripted moment is playing (the rig reports pose 'board') */
  get boarding(): boolean {
    return this.timeline !== null && !this.timeline.done;
  }

  /** 0..1 how far the rider's left arm is out holding the helmet */
  get riderReach(): number {
    return this.timeline?.frame.riderReach ?? 0;
  }

  set(profile: PassengerProfile | null): void {
    if (this.rig && this.rig.profile === profile) return;
    this.finish();
    this.timeline = null;
    this.rig?.dispose();
    this.rig = null;
    if (!profile) return;
    this.rig = new PassengerRig(this.assets, profile);
    this.rig.setCare(this.care.poncho, this.care.mask);
    this.content.add(this.rig.body);
  }

  setCare(poncho: boolean, mask: boolean): void {
    this.care.poncho = poncho;
    this.care.mask = mask;
    this.rig?.setCare(poncho, mask);
  }

  /** play boarding / dismount; resolves when it ends (immediately without a passenger) */
  start(kind: BoardingKind, seconds: number, seatZ: number): Promise<void> {
    this.finish();
    if (!this.rig) return Promise.resolve();
    this.timeline = new BoardingTimeline(kind, Math.max(0.3, seconds), seatZ);
    return new Promise((res) => (this.resolve = res));
  }

  /**
   * A crash puts the passenger on the road too: `holder` (ground frame) while the bike is down, null to climb
   * back on. `side` = the side the bike fell toward (+1 right); they land on the other one.
   */
  spill(holder: Object3D | null, side: number): void {
    const r = this.rig;
    if (!r || holder === this.spilled) return;
    this.spilled = holder;
    this.spillSide = side;
    (holder ?? this.content).add(r.body);
  }

  /** pillion seat gear height (seatLift of the equipped gear) */
  setLift(meters: number): void {
    this.lift = meters;
  }

  /** phase 1: pose before the world-matrix update */
  pose(dt: number, s: PlayerState, pillion: Vector3): void {
    const r = this.rig;
    if (!r) return;
    const seat = this.lifted.copy(pillion);
    seat.y += this.lift;
    if (this.spilled) {
      r.poseOnRoad(this.spillSide * 1.55, seat.z - 0.7, this.spillSide);
      return;
    }
    const tl = this.timeline;
    if (!tl) {
      r.poseSeated(dt, s, seat);
      return;
    }
    tl.advance(dt);
    tl.pose(r.j, r.body, seat);
    r.setSeated(tl.frame.seated);
  }

  /** phase 2: holds + helmet hand-over (world matrices current) */
  solve(riderHips: Object3D, riderHand: Object3D, frame: Object3D, pegZ: number): void {
    const r = this.rig;
    if (!r || this.spilled) return;
    const tl = this.timeline;
    const onHead = !tl || tl.frame.helmetOnPassenger;
    const head = r.j.head;
    if (onHead && r.helmet.parent !== head) {
      head.add(r.helmet);
      r.helmet.position.set(0, 0, 0);
      r.helmet.rotation.set(0, 0, 0);
    } else if (!onHead && r.helmet.parent !== riderHand) {
      riderHand.add(r.helmet);
      r.helmet.position.set(0.02, -0.2, 0.06);
      r.helmet.rotation.set(0.4, 0, 0);
    }
    r.holdRider(riderHips, frame, pegZ, tl ? tl.frame.seated : 1);
    if (tl?.done) {
      this.finish();
      if (tl.kind === 'board') this.timeline = null;
    }
  }

  dispose(): void {
    this.set(null);
  }

  private finish(): void {
    const res = this.resolve;
    this.resolve = null;
    res?.();
  }
}
