import type { EventBus } from '../../core/events';
import type { RunStats } from '../../core/types';
import type { ComfortModel } from '../../logic/comfort';
import type { ComfortEvent } from '../../logic/comfort-tuning';
import type { Situation } from '../../logic/dialogue-lines';
import { recordContact, recordFall, recordPedScare } from '../../logic/run-stats';
import type { StyleTracker } from '../../logic/style';
import { breakStyle, publishStyle, tickStyle } from '../../physics/style-publish';
import type { MissionFrame } from './mission-types';

/** the same pedestrian counts once within this window (contact + startle reports overlap) */
const PED_REPEAT = 4;
/**
 * Body / mirror / curb touches slower than this (km/h) are queue scrapes — wedged between cars in a jam they are part
 * of the game, so they cost no safety points or comfort (they still break a style combo).
 */
export const SCRAPE_KMH = 4;
/** physics re-reports a lasting contact every 0.35 s: one continuous rub on the same thing counts once (s) */
export const CONTACT_EPISODE = 1.5;

type Contact = MissionFrame['contacts'][number];

/** Where incidents go: the run's counters, the passenger's comfort and voice, the bus. */
export interface IncidentSink {
  readonly stats: RunStats;
  readonly comfort: ComfortModel;
  readonly style: StyleTracker;
  readonly bus: EventBus;
  /** comfort only reacts while the passenger is aboard */
  readonly aboard: boolean;
  say(situation: Situation): void;
  /** a comfort change happened (resets the calm clock) */
  upset(): void;
}

/**
 * Safety + style bookkeeping of one fixed step: falls (rising edge of PlayerState.fallen), contact reports, startled
 * pedestrians, and StyleSensor detections scored by the StyleTracker (physics publishStyle → nearMiss / perfectGap /
 * filterPass / combo:end on the bus). A near miss or perfect gap also scares the passenger a little.
 */
export class IncidentFeed {
  private wasFallen = false;
  private time = 0;
  private readonly peds = new Map<number, number>();
  private readonly touched = new Map<string, number>();

  step(dt: number, f: MissionFrame, sink: IncidentSink): void {
    this.time += dt;
    const { stats, style, bus } = sink;
    if (f.player.fallen && !this.wasFallen) {
      recordFall(stats);
      this.comfort(sink, 'fall');
      breakStyle(style, bus);
      this.remark(sink, 'fall');
    }
    this.wasFallen = f.player.fallen;

    for (const c of f.contacts) {
      if (c.kind === 'pedestrian') {
        this.pedScare(stats, c.otherId);
        continue;
      }
      if (c.kind !== 'curb' && c.kind !== 'mirror') breakStyle(style, bus);
      if (!c.heavy && (c.speedKmh < SCRAPE_KMH || this.repeat(c))) continue;
      recordContact(stats, c.kind);
      if (c.kind === 'curb') continue;
      if (c.kind === 'mirror') {
        this.comfort(sink, 'mirror');
        continue;
      }
      if (c.heavy) continue; // the fall that follows carries the comfort hit and the remark
      this.comfort(sink, 'body');
      this.remark(sink, 'crash');
    }
    for (const p of f.pedScares ?? []) this.pedScare(stats, p.id);

    const before = style.nearMisses + style.perfectGaps;
    publishStyle(f.style, style, bus);
    const scares = style.nearMisses + style.perfectGaps - before;
    for (let k = 0; k < scares; k++) this.comfort(sink, 'nearMiss');
    if (scares > 0) this.remark(sink, 'nearMiss');
    tickStyle(style, dt, bus);
  }

  /** true while this contact continues an episode already counted (refreshes the episode clock) */
  private repeat(c: Contact): boolean {
    const key = `${c.kind}:${c.otherId}`;
    const last = this.touched.get(key);
    this.touched.set(key, this.time);
    return last !== undefined && this.time - last < CONTACT_EPISODE;
  }

  private comfort(sink: IncidentSink, kind: ComfortEvent): void {
    if (!sink.aboard) return;
    const d = sink.comfort.event(kind);
    if (!d) return;
    sink.bus.emit('comfort:delta', { delta: d.delta, reason: d.reason, value: d.value });
    sink.upset();
  }

  /** only a passenger on the bike comments on how it is ridden */
  private remark(sink: IncidentSink, situation: Situation): void {
    if (sink.aboard) sink.say(situation);
  }

  private pedScare(stats: RunStats, id: number): void {
    const last = this.peds.get(id);
    if (last !== undefined && this.time - last < PED_REPEAT) return;
    this.peds.set(id, this.time);
    recordPedScare(stats);
  }
}
