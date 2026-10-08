import type { Tracks } from './tracks';
import type { Vehicle } from './vehicle';

const byS = (a: Vehicle, b: Vehicle): number => a.s - b.s || a.id - b.id;

/**
 * Vehicles per track sorted by arc length (rebuilt every fixed step, arrays reused). Answers "who is first in this
 * lane", "who is the next vehicle behind me in that lane" and "how much free road is there at the start of a lane".
 */
export class LaneLists {
  private readonly lists: Vehicle[][];
  private readonly used: number[] = [];

  constructor(private readonly tracks: Tracks) {
    this.lists = tracks.list.map(() => []);
  }

  rebuild(vehicles: readonly Vehicle[]): void {
    for (const t of this.used) this.lists[t].length = 0;
    this.used.length = 0;
    for (const v of vehicles) {
      if (!v.alive) continue;
      const list = this.lists[v.track];
      if (list.length === 0) this.used.push(v.track);
      list.push(v);
    }
    for (const t of this.used) if (this.lists[t].length > 1) this.lists[t].sort(byS);
  }

  /** vehicles on a track, ascending s */
  on(track: number): readonly Vehicle[] {
    return this.lists[track];
  }

  /**
   * Free length at the start of a lane for one more vehicle: the rear of the rearmost vehicle, credited with the
   * distance a moving vehicle will clear in 1.5 s.
   */
  tailRoom(lane: number): number {
    const t = this.tracks.get(lane);
    let room = t.length + 20;
    for (const o of this.lists[lane]) {
      const rear = o.s - o.halfLen + (o.speed > 2 ? o.speed * 1.5 : 0);
      if (rear < room) room = rear;
    }
    return room;
  }

  /** nearest vehicle on `track` with s in (s0, s1) — lane-change gap checks */
  within(track: number, s0: number, s1: number, skip: Vehicle | null, out: Vehicle[]): number {
    out.length = 0;
    for (const o of this.lists[track]) if (o !== skip && o.s > s0 && o.s < s1) out.push(o);
    return out.length;
  }

  /** first vehicle ahead of s (exclusive) on the track, or null */
  ahead(track: number, s: number, skip: Vehicle | null): Vehicle | null {
    for (const o of this.lists[track]) if (o !== skip && o.s > s) return o;
    return null;
  }

  /** last vehicle behind s on the track, or null */
  behind(track: number, s: number, skip: Vehicle | null): Vehicle | null {
    const list = this.lists[track];
    for (let i = list.length - 1; i >= 0; i--) if (list[i] !== skip && list[i].s < s) return list[i];
    return null;
  }
}
