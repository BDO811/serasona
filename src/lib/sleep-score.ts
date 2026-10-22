import { bandForSignal, type DisplayBand } from "./signal-band";
import { BAND_INDEX, SIGN_DEFINITIONS, scoreBandFor, type ScorableSignal, type ScoreBand } from "./serasona-score";

/**
 * The Sleep Score: a second composite over the same recording, read for signs
 * associated with sleep debt in the published literature.
 *
 * This is not a new voice model and Serasona does not ask about sleep,
 * estimate sleep duration, or read anything resembling a sleep stage. It
 * re-reads whichever of the twenty-one clinical signs (serasona-score.ts) the
 * active model(s) already returned, restricted to the subset that published
 * sleep research connects to sleep debt, and reweights them for that
 * question specifically.
 *
 * Only one of these signs has published evidence of being detected directly
 * from voice after sleep loss: fatigue (Thoret 2024, Icht 2020, Gao 2022,
 * Gaur 2023 — see sleep-score-evidence.ts). Every other included sign is
 * here on a different kind of evidence: non-voice sleep research shows sleep
 * debt moves that construct (next-day stress and negative affect, vigilance
 * and cognitive performance, cardiometabolic strain), and Serasona's own
 * voice-based signs separately claim to read that same construct. Two
 * evidence chains joined at the construct, not one study that read both at
 * once. sleep-score-evidence.ts documents the basis per sign and never
 * blurs the two kinds of claim into each other.
 *
 * Reuses bandForSignal and BAND_INDEX from signal-band.ts and
 * serasona-score.ts rather than re-deriving a banding scale: a sign's band
 * is a fact about that sign, independent of which composite is reading it.
 * scoreBandFor's Clear/Watch/Strained thresholds are reused for the same
 * reason — two composites disagreeing on what "Clear" means would be its own
 * source of confusion.
 *
 * Weights are a product judgment call, not a coefficient any cited paper
 * establishes. Fatigue carries the most weight because it is the one sign
 * with direct voice-sleep research behind it; the cognitive and
 * stress/mood signs carry moderate weight because sleep debt's effect on
 * those constructs is well established even though the voice link runs
 * through a separate, often thinner, evidence chain; the cardiometabolic
 * signs carry the least weight because their tie to sleep debt here is
 * physiological rationale rather than a specific study of either.
 */

export const SLEEP_SIGN_WEIGHTS: Record<string, number> = {
  fatigue: 24,
  stress: 13,
  anxiety: 8,
  "mood-disruption": 8,
  "emotional-destabilization": 6,
  "cognitive-load": 11,
  "attention-dysregulation": 9,
  "cognitive-impairment": 5,
  "cardiovascular-strain": 5,
  "elevated-blood-pressure": 4,
  "metabolic-load": 4,
};

/** Every key above must be a real sign in the main catalogue, so a rename
 * there cannot leave this composite silently scoring nothing for it. */
export const SLEEP_SIGN_NAMES: string[] = Object.keys(SLEEP_SIGN_WEIGHTS).filter((name) => {
  if (!SIGN_DEFINITIONS[name]) {
    throw new Error(`sleep-score.ts: "${name}" is not in serasona-score.ts SIGN_DEFINITIONS`);
  }
  return true;
});

export const SLEEP_SCORE_VERSION = "serasona-sleep-1";

export interface ScoredSleepSignal {
  name: string;
  label: string;
  weight: number;
  displayBand: DisplayBand;
  /** 0-100, null when the reading was inconclusive or not in the sleep set. */
  index: number | null;
}

export interface SleepScoreResult {
  /** Null when every present sleep-relevant signal was inconclusive. */
  score: number | null;
  band: ScoreBand | null;
  bandLabel: string | null;
  signals: ScoredSleepSignal[];
  version: string;
  coverageKey: string;
}

function weightedAverage(items: Array<{ index: number; weight: number }>): number | null {
  if (items.length === 0) return null;
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) {
    return Math.round(items.reduce((sum, i) => sum + i.index, 0) / items.length);
  }
  return Math.round(items.reduce((sum, i) => sum + i.index * i.weight, 0) / totalWeight);
}

/**
 * Computes the Sleep Score from whichever signals a recording returned.
 *
 * Signs outside SLEEP_SIGN_WEIGHTS (hydration, allergy, head-impact, and so
 * on) are not read here at all — not excluded for reading NORMAL, simply not
 * part of this question. A recording that returned only those signs has
 * nothing to score, the same way an all-inconclusive recording does.
 */
export function computeSleepScore(signals: ScorableSignal[] | undefined | null): SleepScoreResult | null {
  if (!signals || signals.length === 0) return null;

  const unique = [...new Map(signals.map((s) => [s.name, s])).values()];
  const relevant = unique.filter((s) => SLEEP_SIGN_WEIGHTS[s.name] !== undefined);
  if (relevant.length === 0) return null;

  const scored: ScoredSleepSignal[] = relevant.map((s) => {
    const weight = SLEEP_SIGN_WEIGHTS[s.name];
    const displayBand = bandForSignal(s.name, s.level, s.score);
    const index =
      displayBand === "INCONCLUSIVE" || !Number.isFinite(s.score) || s.score < 0 || s.score > 1
        ? null
        : BAND_INDEX[displayBand];
    return { name: s.name, label: s.label || s.name, weight, displayBand, index };
  });

  const scoreable = scored.filter((s): s is ScoredSleepSignal & { index: number } => s.index !== null);
  const score = weightedAverage(scoreable);
  const { band, bandLabel } = score === null ? { band: null, bandLabel: null } : scoreBandFor(score);

  return {
    score,
    band,
    bandLabel,
    signals: scored,
    version: SLEEP_SCORE_VERSION,
    coverageKey: scoreable.map((s) => s.name).sort().join(","),
  };
}
