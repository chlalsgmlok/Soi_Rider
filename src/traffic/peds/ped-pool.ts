import { PED_ID_BASE } from '../sim/types';
import { Pedestrian } from './pedestrian';

/** Pooled pedestrians with ids from PED_ID_BASE upward (never reused). */
export class PedPool {
  readonly active: Pedestrian[] = [];
  private readonly free: Pedestrian[] = [];
  private readonly byId = new Map<number, Pedestrian>();
  private nextId = PED_ID_BASE;

  spawn(): Pedestrian {
    const p = this.free.pop() ?? new Pedestrian();
    p.reset(this.nextId++);
    this.active.push(p);
    this.byId.set(p.id, p);
    return p;
  }

  despawn(p: Pedestrian): void {
    if (!p.alive) return;
    p.alive = false;
    this.byId.delete(p.id);
    const i = this.active.indexOf(p);
    if (i >= 0) this.active.splice(i, 1);
    this.free.push(p);
  }

  get(id: number): Pedestrian | undefined {
    return this.byId.get(id);
  }

  count(role: Pedestrian['role'] | null): number {
    if (role === null) return this.active.length;
    let n = 0;
    for (const p of this.active) if (p.role === role) n++;
    return n;
  }
}
