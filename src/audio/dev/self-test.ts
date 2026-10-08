import { measureLevels } from './level-meter';
import { renderCase } from './offline-render';
import { SELF_TEST_CASES, type CaseGroup } from './self-test-cases';

export interface SelfTestRow {
  name: string;
  group: CaseGroup;
  seconds: number;
  /** RMS of the mastered render (what the player hears) */
  rms: number;
  /** peak of the mastered render */
  peak: number;
  /** peak of the raw mix before the glue compressor / limiter (headroom check) */
  rawPeak: number;
  /** loudest 50 ms RMS window of the raw mix (mix-balance metric) */
  rawLoud: number;
  nan: boolean;
  /** non-silent, finite, mastered peak < 1 */
  ok: boolean;
  /** wall-clock render time of both passes */
  ms: number;
}

export interface SelfTestOptions {
  /** only cases whose name matches */
  filter?: string;
  sampleRate?: number;
  /** offline renders running at once */
  concurrency?: number;
  onRow?: (row: SelfTestRow) => void;
}

/** below this RMS a sound counts as silent (−80 dBFS) */
const SILENT_RMS = 1e-4;

/**
 * Render every key sound (all SFX, UI sounds, horns, engines, ride noise, ambience beds, thunder, music tracks and
 * the stinger) through an OfflineAudioContext — once mastered, once raw — and report levels.
 */
export async function runAudioSelfTest(opts: SelfTestOptions = {}): Promise<SelfTestRow[]> {
  const sr = opts.sampleRate ?? 44100;
  const filter = opts.filter;
  const cases = SELF_TEST_CASES.filter((c) => !filter || c.name.includes(filter));
  const rows: SelfTestRow[] = new Array<SelfTestRow>(cases.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < cases.length) {
      const i = next++;
      const c = cases[i];
      const t0 = performance.now();
      const [mastered, raw] = await Promise.all([renderCase(c, sr, true), renderCase(c, sr, false)]);
      const m = measureLevels(mastered, sr);
      const r = measureLevels(raw, sr);
      const nan = m.nan || r.nan;
      const row: SelfTestRow = {
        name: c.name, group: c.group, seconds: c.seconds, rms: m.rms, peak: m.peak, rawPeak: r.peak, rawLoud: r.momentary, nan,
        ok: !nan && m.rms > SILENT_RMS && m.peak < 1, ms: Math.round(performance.now() - t0),
      };
      rows[i] = row;
      opts.onRow?.(row);
    }
  };
  const n = Math.max(1, Math.min(8, opts.concurrency ?? 3));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return rows;
}

export interface SelfTestSummary {
  total: number;
  ok: number;
  failed: string[];
  maxPeak: number;
  maxRawPeak: number;
  /** cases whose raw mix exceeds full scale (the limiter is doing real work there) */
  hot: string[];
  quietest: string;
}

export function summarizeSelfTest(rows: readonly SelfTestRow[]): SelfTestSummary {
  const quiet = rows.reduce<SelfTestRow | null>((q, r) => (!q || r.rms < q.rms ? r : q), null);
  return {
    total: rows.length,
    ok: rows.filter((r) => r.ok).length,
    failed: rows.filter((r) => !r.ok).map((r) => r.name),
    maxPeak: Math.max(0, ...rows.map((r) => r.peak)),
    maxRawPeak: Math.max(0, ...rows.map((r) => r.rawPeak)),
    hot: rows.filter((r) => r.rawPeak >= 1).map((r) => r.name),
    quietest: quiet ? quiet.name : '',
  };
}
