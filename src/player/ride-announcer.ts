import type { EventBus } from '../core/events';
import { type PlayerState, Surface } from '../core/types';

/** Announces riding-state changes on the bus: sidewalk riding and counterflow (on/off edges only). */
export class RideAnnouncer {
  private sidewalk = false;
  private counter = false;

  constructor(private readonly bus: EventBus | null) {}

  update(s: PlayerState): void {
    const walk = !s.fallen && (s.surface === Surface.Sidewalk || s.surface === Surface.Plaza);
    if (walk !== this.sidewalk) {
      this.sidewalk = walk;
      this.bus?.emit('sidewalk', { active: walk });
    }
    const counter = !s.fallen && s.counterflow;
    if (counter !== this.counter) {
      this.counter = counter;
      this.bus?.emit('counterflow', { active: counter });
    }
  }
}
