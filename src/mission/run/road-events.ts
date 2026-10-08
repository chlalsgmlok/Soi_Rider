import type { EventBus } from '../../core/events';
import type { CityData, PassengerTrait, POI, RunStats } from '../../core/types';
import type { Situation } from '../../logic/dialogue-lines';
import { recordLandmark, recordRedLight } from '../../logic/run-stats';
import { LANDMARK_MAX } from '../../logic/score-lines';
import { LandmarkWatch } from './landmark-watch';
import type { MissionFrame } from './mission-types';
import { RedLightWatch } from './red-light-watch';
import { SmoothArrival } from './smooth-arrival';

export interface RoadSink {
  readonly stats: RunStats;
  readonly bus: EventBus;
  readonly aboard: boolean;
  /** the drop-off approach is on (smooth-arrival tracking) */
  readonly arriving: boolean;
  say(situation: Situation, place?: string): void;
}

/**
 * Things the street itself scores: red lights run (−200 safety, 'redLight' on the bus), a tourist's slow landmark
 * passes (+150 care each, max 3) and the braking profile of the final approach (smooth-arrival bonus).
 */
export class RoadEvents {
  readonly arrival = new SmoothArrival();
  private readonly red: RedLightWatch;
  private readonly landmarks: LandmarkWatch;

  constructor(data: CityData, private readonly trait: PassengerTrait, private readonly drop: POI, pickup: POI) {
    this.red = new RedLightWatch(data);
    this.landmarks = new LandmarkWatch(data.pois, [pickup.id, drop.id]);
  }

  step(dt: number, f: MissionFrame, sink: RoadSink): void {
    const p = f.player;
    const traffic = f.traffic;
    const node = traffic ? this.red.update(p, (n) => traffic.signal(n)) : -1;
    if (node >= 0) {
      recordRedLight(sink.stats);
      sink.bus.emit('redLight', { node });
      sink.bus.emit('toast', { text: '신호 위반 −200', tone: 'bad', icon: 'warning' });
    }
    if (sink.aboard && this.trait === 'tourist' && sink.stats.landmarkBonus < LANDMARK_MAX) {
      const spot = this.landmarks.update(dt, p.pos, p.speed);
      if (spot) {
        recordLandmark(sink.stats);
        sink.say('landmark', spot.name);
        sink.bus.emit('toast', { text: `${spot.name} 사진 찰칵! +150`, tone: 'good', icon: 'camera' });
      }
    }
    if (sink.arriving) this.arrival.update(Math.hypot(p.pos.x - this.drop.pos.x, p.pos.z - this.drop.pos.z), p.accel);
  }
}
