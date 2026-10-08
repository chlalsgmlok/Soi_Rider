import type { BackdropScene } from '../backdrop';

/** One backdrop wired for sandbox/scenes.html (dev only): the scene plus its debug keys and readouts. */
export interface Harness {
  scene: BackdropScene;
  /** keyboard shortcut (KeyboardEvent.code); true when handled */
  key(code: string): boolean;
  /** one-line status for the sandbox HUD */
  info(): string;
  /** numbers for window.__stats */
  stats(): Record<string, unknown>;
}

/** URL helpers shared by the harnesses */
export const param = (qs: URLSearchParams, k: string, d: number): number => (qs.has(k) ? Number(qs.get(k)) : d);
export const pick = <T extends string>(qs: URLSearchParams, k: string, list: readonly T[], d: T): T =>
  list.find((v) => v === qs.get(k)) ?? d;
export const cycle = <T>(list: readonly T[], v: T): T => list[(list.indexOf(v) + 1) % list.length];
