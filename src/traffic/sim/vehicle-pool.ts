import type { VehicleSpec } from '../../core/types';
import type { JunctionGate } from './junction-gate';
import { Vehicle } from './vehicle';

/**
 * Pooled vehicles: `active` is the live list in a stable order (spawn order), dead objects are recycled so the
 * steady state allocates nothing. Ids keep increasing (never reused) so views and collision reports stay unambiguous.
 */
export class VehiclePool {
  readonly active: Vehicle[] = [];
  private readonly free: Vehicle[] = [];
  private nextId = 1;
  private readonly byId = new Map<number, Vehicle>();

  constructor(private readonly gate: JunctionGate) {}

  spawn(spec: VehicleSpec, isMoto: boolean): Vehicle {
    const v = this.free.pop() ?? new Vehicle();
    v.reset(this.nextId++, spec, isMoto);
    this.active.push(v);
    this.byId.set(v.id, v);
    return v;
  }

  despawn(v: Vehicle): void {
    if (!v.alive) return;
    this.gate.release(v);
    v.alive = false;
    this.byId.delete(v.id);
    const i = this.active.indexOf(v);
    if (i >= 0) this.active.splice(i, 1);
    this.free.push(v);
  }

  get(id: number): Vehicle | undefined {
    return this.byId.get(id);
  }

  count(moto: boolean): number {
    let n = 0;
    for (const v of this.active) if (v.isMoto === moto) n++;
    return n;
  }

  clear(): void {
    for (const v of [...this.active]) this.despawn(v);
  }
}
