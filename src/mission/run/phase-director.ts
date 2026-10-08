import type { EventBus } from '../../core/events';
import type { PassengerProfile, PlayerState, POI, RunConfig, RunStats, Vec2 } from '../../core/types';
import type { ComfortModel } from '../../logic/comfort';
import type { Situation } from '../../logic/dialogue-lines';
import { failReasonFor } from '../../logic/run-stats';
import { FAIL_LABEL } from '../../logic/score-lines';
import type { Navigator, NavPose } from '../nav/navigator';
import type { MissionHooks } from './mission-types';
import { BOARD_SEC, DROP_SEC, type PhaseFlow } from './phase-flow';
import type { RoadEvents } from './road-events';

/** what the phase side effects touch */
export interface DirectorSink {
  readonly flow: PhaseFlow;
  readonly nav: Navigator;
  readonly stats: RunStats;
  readonly comfort: ComfortModel;
  readonly bus: EventBus;
  readonly hooks: MissionHooks;
  readonly passenger: PassengerProfile;
  /** the run's config (the passenger notices a golden throne on the pillion) */
  readonly config: RunConfig;
  readonly drop: POI;
  readonly road: RoadEvents;
  readonly pose: NavPose;
  readonly targetPos: Vec2 | null;
  readonly aboard: boolean;
  say(situation: Situation): void;
}

/** comfort at the drop that still counts as a happy arrival (passenger remark) */
const HAPPY_ARRIVAL = 55;

/**
 * Advances the phase machine one step and plays what each transition means: greet + boarding hook, route to the
 * drop + "let's go", smooth-arrival verdict + farewell + drop-off hook, and the end of the run.
 */
export function advancePhase(m: DirectorSink, dt: number, p: PlayerState): void {
  const target = m.targetPos;
  const d = target ? Math.hypot(target.x - p.pos.x, target.z - p.pos.z) : Infinity;
  const prev = m.flow.phase;
  const step = m.flow.update(dt, { distToTarget: d, remaining: m.nav.path ? m.nav.remaining : d, speed: p.speed, fallen: p.fallen });
  if (step === 'dropStart') {
    m.stats.smoothArrival = m.road.arrival.smooth(m.flow.stopDist);
    if (m.stats.smoothArrival) m.bus.emit('toast', { text: '부드러운 도착 +300', tone: 'good', icon: 'check' });
    m.say(m.comfort.value >= HAPPY_ARRIVAL ? 'arriveGood' : 'arriveBad');
    holdScene(m.flow, m.hooks.dismount?.(m.passenger, DROP_SEC));
    return;
  }
  if (!step) return;
  m.bus.emit('mission:phase', { phase: step, prev });
  if (step === 'boarding') {
    m.say('greet');
    holdScene(m.flow, m.hooks.board?.(m.passenger, BOARD_SEC));
  } else if (step === 'toDropoff' && prev === 'boarding') {
    m.nav.setTarget(m.drop, m.pose);
    m.say(m.config.loadout.gear === 'gear_throne' ? 'throne' : 'board');
  } else if (step === 'complete') finish(m, 'complete');
}

/** §8 fail rules (comfort 0, 3 falls, 2.5 × ETA) or an abandon already recorded in stats.failed */
export function checkFail(m: DirectorSink): void {
  const reason = failReasonFor(m.stats, m.comfort.failed);
  if (!reason) return;
  const prev = m.flow.phase;
  const wasAboard = m.aboard;
  m.stats.failed = reason;
  if (!m.flow.fail()) return;
  m.bus.emit('mission:phase', { phase: 'failed', prev });
  m.bus.emit('toast', { text: FAIL_LABEL[reason], tone: 'bad', icon: 'warning' });
  // an upset passenger gets off right there
  if (reason === 'comfort' && wasAboard) void m.hooks.dismount?.(m.passenger, DROP_SEC);
  finish(m, 'failed');
}

function finish(m: DirectorSink, phase: 'complete' | 'failed'): void {
  m.nav.setTarget(null, m.pose);
  m.hooks.ended?.(phase);
}

/** a hook's promise holds the scripted moment until it settles */
function holdScene(flow: PhaseFlow, r: Promise<void> | void): void {
  if (!r) return;
  flow.awaitScene();
  const done = (): void => flow.sceneFinished();
  r.then(done, done);
}
