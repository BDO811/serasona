import { computeSerasonaScore, scoreBandFor, type ScorableSignal } from "./serasona-score";

/** Product index of mental readiness, using the existing validated display
 * bands. These weights are product choices, not clinical coefficients or a
 * measurement of cognitive impairment. Pulse supplies fatigue and the
 * stress/mood signs; specialist models can supply direct cognitive signs.
 * The overall Serasona formula and its mutually exclusive groups stay intact.
 */
export const CLARITY_SIGN_WEIGHTS: Record<string, number> = {
  fatigue: 30,
  "cognitive-impairment": 25,
  "cognitive-load": 20,
  "attention-dysregulation": 20,
  stress: 15,
  anxiety: 10,
  "mood-disruption": 10,
};
export const CLARITY_SCORE_VERSION = "serasona-clarity-1";
const ANCHORS = new Set(["fatigue", "cognitive-impairment", "cognitive-load", "attention-dysregulation"]);

export function computeClarityScore(signals: ScorableSignal[] | undefined | null) {
  const scored = computeSerasonaScore(signals)?.signals
    .filter((signal) => CLARITY_SIGN_WEIGHTS[signal.name] !== undefined)
    .map((signal) => ({ ...signal, weight: CLARITY_SIGN_WEIGHTS[signal.name] })) ?? [];
  const readable = scored.filter((signal) => signal.index !== null);
  // Stress or mood alone cannot stand in for mental readiness.
  if (!readable.some((signal) => ANCHORS.has(signal.name))) return null;
  const totalWeight = readable.reduce((sum, signal) => sum + signal.weight, 0);
  const score = Math.round(readable.reduce((sum, signal) => sum + signal.index! * signal.weight, 0) / totalWeight);
  return { score, ...scoreBandFor(score), signals: scored, version: CLARITY_SCORE_VERSION,
    coverageKey: readable.map((signal) => signal.name).sort().join(",") };
}
