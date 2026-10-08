import type { Vec2 } from './types/geometry';
import type { MissionPhase, RunResult, WeatherKind } from './types/game';
import type { PromptId, PromptState } from './types/hud';
import type { CameraMode } from './types/save';
import type { VehicleKind } from './types/vehicles';

export type CollisionKind = 'body' | 'mirror' | 'moto' | 'pedestrian' | 'static' | 'curb';
export type Mood = 'happy' | 'neutral' | 'scared' | 'angry' | 'wet' | 'cough';
export type Tone = 'info' | 'good' | 'warn' | 'bad';
export type UiSfx = 'tap' | 'hover' | 'back' | 'buy' | 'deny' | 'coin' | 'stamp' | 'ping' | 'swoosh' | 'equip' | 'count';

/** Every cross-module notification. Payloads are plain data. */
export interface GameEvents {
  collision: { kind: CollisionKind; heavy: boolean; speedKmh: number; point: Vec2; other: string };
  'player:fall': { reason: string };
  'player:recover': Record<string, never>;
  nearMiss: { clearanceCm: number; speedKmh: number; side: 'left' | 'right'; combo: number; points: number };
  perfectGap: { leftCm: number; rightCm: number; combo: number; points: number };
  filterPass: { total: number };
  'combo:end': { combo: number };
  /** `kind` (optional): which NPC vehicle honked, so audio can pick its horn (bus air horn, tuk-tuk pip-pip …) */
  horn: { by: 'player' | 'npc'; pos: Vec2; kind?: VehicleKind };
  counterflow: { active: boolean };
  sidewalk: { active: boolean };
  redLight: { node: number };
  'weather:change': { from: WeatherKind; to: WeatherKind; rain: number };
  thunder: { distance: number };
  splash: { pos: Vec2; onPedestrian: boolean };
  'story:prompt': PromptState;
  'story:resolve': { id: PromptId; success: boolean };
  'mission:phase': { phase: MissionPhase; prev: MissionPhase };
  'comfort:delta': { delta: number; reason: string; value: number };
  'passenger:say': { text: string; mood: Mood };
  toast: { text: string; tone: Tone; icon?: string };
  'camera:mode': { mode: CameraMode };
  'camera:shake': { strength: number; duration: number };
  'run:complete': RunResult;
  'ui:sfx': { name: UiSfx };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;
type AnyHandler = (payload: never) => void;

/** Tiny typed pub/sub. One instance per app (see `bus`), cleared between runs with `offAllOwnedBy`. */
export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<AnyHandler>>();
  private owners = new Map<object, Array<[keyof GameEvents, AnyHandler]>>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<K>, owner?: object): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn as AnyHandler);
    if (owner) {
      const list = this.owners.get(owner) ?? [];
      list.push([type, fn as AnyHandler]);
      this.owners.set(owner, list);
    }
    return () => this.off(type, fn);
  }

  once<K extends keyof GameEvents>(type: K, fn: Handler<K>): () => void {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof GameEvents>(type: K, fn: Handler<K>): void {
    this.handlers.get(type)?.delete(fn as AnyHandler);
  }

  /** remove every handler registered with this owner */
  offAllOwnedBy(owner: object): void {
    for (const [type, fn] of this.owners.get(owner) ?? []) this.handlers.get(type)?.delete(fn);
    this.owners.delete(owner);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        (fn as Handler<K>)(payload);
      } catch (err) {
        console.error(`[bus] handler for "${String(type)}" failed`, err);
      }
    }
  }
}

export const bus = new EventBus();
