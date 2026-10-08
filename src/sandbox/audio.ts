import { COST_SCENARIOS } from '../audio/dev/cost-scenarios';
import { renderCost } from '../audio/dev/offline-render';
import { runAudioSelfTest, summarizeSelfTest, type SelfTestOptions } from '../audio/dev/self-test';

interface AudioWindow {
  __ready?: boolean;
  __audioSelfTest?: (opts?: SelfTestOptions) => Promise<unknown>;
  __audioCost?: () => Promise<Record<string, number>>;
}
const W = window as unknown as AudioWindow;
W.__audioSelfTest = async (opts) => {
  const rows = await runAudioSelfTest(opts);
  return { summary: summarizeSelfTest(rows), rows };
};
W.__audioCost = async () => {
  const out: Record<string, number> = {};
  for (const c of COST_SCENARIOS) {
    let best = Infinity;
    for (let i = 0; i < 3; i++) best = Math.min(best, await renderCost(c));
    out[c.name] = Math.round(best * 10000) / 10000;
  }
  return out;
};
W.__ready = true;
