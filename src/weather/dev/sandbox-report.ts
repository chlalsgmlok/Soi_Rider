import type { EngineStats } from '../../engine/engine-stats';
import type { WeatherState } from '../types';

/** bus events the weather sandbox counts */
export interface SandboxCounts {
  splash: number;
  /** splashes that hit a pedestrian (mission penalty) */
  soaked: number;
  thunder: number;
  exhaust: number;
  /** last 'weather:change' as "from→to" */
  change: string;
}

export interface SandboxFrame {
  engine: EngineStats;
  weather: Readonly<WeatherState>;
  counts: SandboxCounts;
  tod: string;
  cam: string;
  fx: boolean;
  kmh: number;
  /** weather clock (s) */
  time: number;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** window.__stats for headless checks */
export function sandboxStats(f: SandboxFrame): Record<string, number | string | boolean> {
  const { engine: s, weather: w, counts: c } = f;
  return {
    fps: Math.round(s.fps), gpuMs: r2(s.gpuMs), cpuMs: r2(s.cpuMs), drawCalls: s.drawCalls, triangles: s.triangles, preset: s.preset,
    tod: f.tod, kind: w.kind, phase: w.phase, event: w.event ?? 'none', overcast: r2(w.overcast), rain: r2(w.rain), gloom: r2(w.gloom),
    haze: r2(w.haze), wetness: r2(w.wetness), wind: r2(w.wind), lightning: r2(w.lightning), splashes: c.splash, soaked: c.soaked,
    thunder: c.thunder, exhaust: c.exhaust, change: c.change, kmh: f.kmh, cam: f.cam, fx: f.fx, time: r2(f.time),
  };
}

/** the on-screen readout */
export function sandboxHud(f: SandboxFrame): string {
  const { engine: s, weather: w, counts: c } = f;
  return `<b>${w.phase.toUpperCase()}</b> · ${w.kind} · ${f.tod} · ${f.cam} · ${s.preset}${f.fx ? '' : ' · <i>FX OFF</i>'}\n` +
    `rain ${w.rain.toFixed(2)} · wet ${w.wetness.toFixed(2)} · haze ${w.haze.toFixed(2)} · cloud ${w.overcast.toFixed(2)} · wind ${w.wind.toFixed(2)}\n` +
    `${s.fps.toFixed(0)} fps · ${s.drawCalls} draws · gpu ${s.gpuMs.toFixed(1)} ms · splashes ${c.splash} (${c.soaked} soaked) · thunder ${c.thunder}`;
}
