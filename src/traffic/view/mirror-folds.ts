import type { EventBus, GameEvents } from '../../core/events';
import type { Vehicle } from '../sim/vehicle';
import type { AgentFxTable } from './agent-fx';

interface Hit {
  id: number;
  x: number;
  z: number;
}

/** NPC id inside a collision report's `other` ("12", "npc:12", "vehicle#12" …), or -1 */
export function npcIdOf(other: string): number {
  const m = /(\d+)\s*$/.exec(other);
  return m ? Number(m[1]) : -1;
}

/**
 * Folds an NPC mirror when the rider clips it: listens for `collision` events whose `other` names an NPC vehicle
 * (kind 'mirror', or a light 'body' graze near a mirror) and folds the mirror on the side of the contact point.
 */
export class MirrorFolds {
  private readonly pending: Hit[] = [];
  private readonly free: Hit[] = [];

  constructor(bus: EventBus | null) {
    bus?.on('collision', (e) => this.onCollision(e), this);
    this.bus = bus;
  }

  private readonly bus: EventBus | null;

  private onCollision(e: GameEvents['collision']): void {
    if (e.kind !== 'mirror' && !(e.kind === 'body' && !e.heavy)) return;
    const id = npcIdOf(e.other);
    if (id < 0) return;
    const h = this.free.pop() ?? { id: 0, x: 0, z: 0 };
    h.id = id;
    h.x = e.point.x;
    h.z = e.point.z;
    this.pending.push(h);
  }

  /** apply queued hits (call once per frame before drawing) */
  apply(find: (id: number) => Vehicle | undefined, fx: AgentFxTable): void {
    for (const h of this.pending) {
      const v = find(h.id);
      if (v && v.mirrors.length === 2) {
        const left = (h.x - v.pos.x) * Math.cos(v.heading) - (h.z - v.pos.z) * Math.sin(v.heading) > 0;
        const along = (h.x - v.pos.x) * Math.sin(v.heading) + (h.z - v.pos.z) * Math.cos(v.heading);
        if (Math.abs(along - v.spec.mirrorZ) < 1.2) fx.get(v.id).fold(left);
      }
      this.free.push(h);
    }
    this.pending.length = 0;
  }

  dispose(): void {
    this.bus?.offAllOwnedBy(this);
  }
}
