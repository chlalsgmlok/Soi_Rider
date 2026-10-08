/**
 * Evaluate these params once per 128-sample render quantum instead of per sample. Params that JS steers at
 * frame rate (filter cutoffs, oscillator pitch, slow wobble inputs) sound the same, but an automated biquad
 * no longer recomputes its coefficients every sample and an oscillator keeps its fast path — measured 2–3×
 * cheaper. Silently skipped where unsupported or where a param's rate is fixed by the spec.
 */
export function kRate(...params: AudioParam[]): void {
  for (const p of params) {
    if (!('automationRate' in p) || p.automationRate === 'k-rate') continue;
    try {
      p.automationRate = 'k-rate';
    } catch {
      // rate is fixed for this param (InvalidStateError) — keep the default
    }
  }
}
