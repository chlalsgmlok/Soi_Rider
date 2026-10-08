import { KMH } from '../core/math2d';
import type { AppCtx, AppState } from './app-context';

/** the live run as tests read it */
export interface RunProbe {
  mode: string;
  phase: string;
  progress: number;
  remaining: number;
  kmh: number;
  comfort: number;
  eta: number;
  t: number;
  falls: number;
  bumps: number;
  nearMisses: number;
  redLights: number;
  prompt: string | null;
  raincoat: string;
  mask: string;
  weather: string;
  rain: number;
  bot: string | null;
  pos: [number, number];
  pickup: string;
  drop: string;
  trait: string;
}

/** window.__game: test / QA introspection (tools/e2e.mjs waits on `state`, reads `run` and `result`) */
export interface GameProbeData {
  state: AppState;
  /** the mission phase of the live run (null outside a run) */
  phase: string | null;
  fps: number;
  drawCalls: number;
  preset: string;
  /** renderer memory (leak checks across runs) */
  mem: { geometries: number; textures: number; programs: number };
  config: { seed: number; district: string; intensity: string; tod: string; weather: string; events: string[]; trip: number } | null;
  run: RunProbe | null;
  result: { grade: string; total: number; stars: number; totalBaht: number; failed: string | null; timeSec: number; etaSec: number; comfort: number; newBest: boolean } | null;
  save: { baht: number; fuel: number; trips: number; loadout: string };
  /** the latest contacts of the run (kind, closing km/h, what was hit) — QA of collisions */
  contacts: Array<{ t: number; kind: string; heavy: boolean; kmh: number; other: string }>;
  debug: { failComfort(): boolean };
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Publishes the app's state to `window.__game` (every 15 frames + on demand). */
export class GameProbe {
  readonly data: GameProbeData;
  private frames = 0;

  constructor(private readonly ctx: AppCtx) {
    this.data = {
      state: ctx.state, phase: null, fps: 0, drawCalls: 0, preset: '', mem: { geometries: 0, textures: 0, programs: 0 }, config: null,
      run: null, result: null,
      save: { baht: 0, fuel: 0, trips: 0, loadout: '' }, contacts: [],
      debug: { failComfort: () => ctx.session?.failComfort() ?? false },
    };
    (window as unknown as { __game: GameProbeData }).__game = this.data;
    ctx.bus.on('collision', (c) => {
      const t = ctx.session?.run?.mission.stats.timeSec ?? 0;
      this.data.contacts.push({ t: r1(t), kind: c.kind, heavy: c.heavy, kmh: r1(c.speedKmh), other: c.other });
      if (this.data.contacts.length > 40) this.data.contacts.shift();
    }, this);
    this.publish();
  }

  tick(): void {
    this.data.state = this.ctx.state;
    if (++this.frames % 15 === 0) this.publish();
  }

  publish(): void {
    const { ctx, data } = this;
    const st = ctx.engine.stats();
    const save = ctx.saves.save;
    const l = save.loadout;
    data.state = ctx.state;
    data.fps = Math.round(st.fps);
    data.drawCalls = st.drawCalls;
    data.preset = st.preset;
    data.mem = { geometries: st.geometries, textures: st.textures, programs: st.programs };
    data.save = { baht: save.baht, fuel: save.fuel, trips: save.tripsCompleted, loadout: `${l.bike}/${l.bikeColor}/${l.helmet}/${l.helmetColor}/${l.outfit}/${l.outfitColor}` };
    const s = ctx.session;
    const c = s?.config;
    data.config = c ? {
      seed: c.seed, district: c.district, intensity: c.intensity, tod: c.timeOfDay, weather: c.weather.base,
      events: c.weather.events.map((e) => `${e.kind}@${e.atProgress.toFixed(2)}`), trip: c.tripNumber,
    } : data.config;
    data.run = s?.run ? this.runProbe() : null;
    data.phase = data.run?.phase ?? null;
    const res = ctx.lastResult;
    data.result = res ? {
      grade: res.grade, total: res.total, stars: res.stars, totalBaht: res.totalBaht, failed: res.stats.failed,
      timeSec: r1(res.stats.timeSec), etaSec: res.stats.etaSec, comfort: r1(res.stats.finalComfort), newBest: res.newBest,
    } : null;
  }

  private runProbe(): RunProbe | null {
    const s = this.ctx.session;
    const m = s?.run?.mission;
    if (!s || !m) return null;
    const b = s.ride.bike.state;
    const w = s.weather.system.state;
    const bot = s.control.bot;
    return {
      mode: s.mode, phase: m.phase, progress: +m.tripProgress.toFixed(3), remaining: Math.round(m.nav.remaining),
      kmh: r1(Math.abs(b.speed) * KMH), comfort: r1(m.comfort.value), eta: m.stats.etaSec, t: r1(m.stats.timeSec),
      falls: m.stats.falls, bumps: m.stats.bumps, nearMisses: m.style.nearMisses, redLights: m.stats.redLights,
      prompt: m.prompt?.id ?? null, raincoat: m.stats.raincoat, mask: m.stats.mask, weather: w.kind, rain: +w.rain.toFixed(2),
      bot: bot ? `${bot.limit}:${bot.target.toFixed(1)}` : null, pos: [r1(b.pos.x), r1(b.pos.z)],
      pickup: m.pickup.name, drop: m.drop.name, trait: m.passenger.trait,
    };
  }
}
