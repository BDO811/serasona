import { bandForSignal, type DisplayBand } from "./signal-band";

/**
 * The Serasona Score: one composite read across whatever signs the active
 * model(s) on a user's plan actually returned.
 *
 * The product names seven signals in its own marketing copy (stress, mood,
 * energy, confidence, mental fatigue, alertness, focus) — the v2 API returns
 * none of those. Each model in the real catalogue (src/lib/models.ts) returns
 * a different, fixed bundle drawn from twenty-one clinical signs instead.
 * This module is the real mapping: every sign the API can return is bucketed
 * into one of three display groups and given a weight, so the composite
 * always reflects what was actually measured, never a signal no model
 * returned.
 *
 * Scored from band, not raw score. signal-band.ts documents why: "score is
 * for internal use only; use level for display" — score-to-level calibration
 * is distribution-based and unique per model, so two signs at the same raw
 * score can sit at different severities (a real apex run: anxiety 0.359 came
 * back `consider`, cognitive load 0.273 came back `moderate`). Averaging raw
 * scores across signs would silently repeat that mistake. bandForSignal()
 * already applies every per-sign override (percentile-bucketed signs,
 * flag-only-when-elevated signs), so this reuses it rather than
 * re-deriving a second, divergent severity scale.
 *
 * A sign reading INCONCLUSIVE is excluded from the composite entirely, the
 * same way signal-band.ts keeps it outside the NORMAL..ELEVATED scale:
 * unreadable audio is not evidence of a normal reading.
 *
 * Weights are a product judgment call pending real outcome data: stress and
 * anxiety carry the most weight (the brief asked for a score "weighted
 * towards stress"), the physiological/behavioural signs under Wellness are
 * weighted individually lower since several can appear together under one
 * model, and the composite renormalizes to whichever signs are present on a
 * given reading.
 */

export type ScoreGroup = "stress" | "wellness" | "clarity";

interface SignDefinition {
  group: ScoreGroup;
  weight: number;
}

export const SIGN_DEFINITIONS: Record<string, SignDefinition> = {
  // Stress — mental and emotional strain.
  stress: { group: "stress", weight: 20 },
  anxiety: { group: "stress", weight: 16 },
  "mood-disruption": { group: "stress", weight: 10 },
  hypervigilance: { group: "stress", weight: 10 },
  "emotional-destabilization": { group: "stress", weight: 10 },

  // Wellness — physiological and general-health signs. Several can appear
  // together under one model (Tide returns six), so each carries a smaller
  // individual weight.
  fatigue: { group: "wellness", weight: 10 },
  "elevated-blood-pressure": { group: "wellness", weight: 7 },
  "cardiovascular-strain": { group: "wellness", weight: 7 },
  dehydration: { group: "wellness", weight: 6 },
  "airway-obstruction-pattern": { group: "wellness", weight: 6 },
  "alcohol-use-pattern": { group: "wellness", weight: 6 },
  "substance-use-pattern": { group: "wellness", weight: 6 },
  "metabolic-load": { group: "wellness", weight: 5 },
  "iron-deficiency": { group: "wellness", weight: 4 },
  "elevated-androgens": { group: "wellness", weight: 4 },
  allergy: { group: "wellness", weight: 4 },
  "dry-mouth": { group: "wellness", weight: 3 },

  // Clarity — cognitive signs.
  "cognitive-impairment": { group: "clarity", weight: 14 },
  "cognitive-load": { group: "clarity", weight: 9 },
  "head-impact": { group: "clarity", weight: 9 },
  "attention-dysregulation": { group: "clarity", weight: 9 },
};

export const GROUP_ORDER: ScoreGroup[] = ["stress", "wellness", "clarity"];

export const GROUP_LABELS: Record<ScoreGroup, string> = {
  stress: "Stress",
  wellness: "Wellness",
  clarity: "Clarity",
};

/** A sign the registry doesn't recognise yet (the catalogue added one).
 * Keeps a real reading from being silently dropped out of the composite. */
const FALLBACK_WEIGHT = 6;
const FALLBACK_GROUP: ScoreGroup = "wellness";

function definitionFor(name: string): SignDefinition {
  return SIGN_DEFINITIONS[name] ?? { group: FALLBACK_GROUP, weight: FALLBACK_WEIGHT };
}

/** Band to composite index. Ordinal, not linear in raw score — see module
 * doc. Inconclusive has no index; it is filtered out before this runs. */
const BAND_INDEX: Record<Exclude<DisplayBand, "INCONCLUSIVE">, number> = {
  NORMAL: 100,
  LOW: 68,
  MODERATE: 38,
  ELEVATED: 8,
};

export type ScoreBand = "clear" | "watch" | "strained";

export function scoreBandFor(score: number): { band: ScoreBand; bandLabel: string } {
  if (score >= 67) return { band: "clear", bandLabel: "Clear" };
  if (score >= 34) return { band: "watch", bandLabel: "Watch" };
  return { band: "strained", bandLabel: "Strained" };
}

/** The minimal shape this module needs from a signal — satisfied by both
 * StoredSignal (voice-history-client.ts) and SignalSummary (result-types.ts)
 * without importing either, so this stays independent of which one a caller
 * has on hand. */
export interface ScorableSignal {
  name: string;
  label: string;
  score: number;
  level: string | null | undefined;
}

export interface ScoredSignal {
  name: string;
  label: string;
  group: ScoreGroup;
  weight: number;
  displayBand: DisplayBand;
  /** 0-100, null when the reading was inconclusive. */
  index: number | null;
}

export interface GroupScore {
  group: ScoreGroup;
  label: string;
  /** Weighted average index across this group's scoreable signals, 0-100.
   * Null when every signal in the group was inconclusive. */
  index: number | null;
  signals: ScoredSignal[];
}

export interface SerasonaScoreResult {
  /** Null when every present signal was inconclusive. */
  score: number | null;
  band: ScoreBand | null;
  bandLabel: string | null;
  /** Only the groups with at least one present signal, in a fixed order. */
  groups: GroupScore[];
  signals: ScoredSignal[];
}

function weightedAverage(items: Array<{ index: number; weight: number }>): number | null {
  if (items.length === 0) return null;
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) {
    return Math.round(items.reduce((sum, i) => sum + i.index, 0) / items.length);
  }
  return Math.round(items.reduce((sum, i) => sum + i.index * i.weight, 0) / totalWeight);
}

export function computeSerasonaScore(
  signals: ScorableSignal[] | undefined | null
): SerasonaScoreResult | null {
  if (!signals || signals.length === 0) return null;

  const scored: ScoredSignal[] = signals.map((s) => {
    const def = definitionFor(s.name);
    const displayBand = bandForSignal(s.name, s.level, s.score);
    const index = displayBand === "INCONCLUSIVE" ? null : BAND_INDEX[displayBand];
    return { name: s.name, label: s.label || s.name, group: def.group, weight: def.weight, displayBand, index };
  });

  const scoreable = scored.filter(
    (s): s is ScoredSignal & { index: number } => s.index !== null
  );
  const score = weightedAverage(scoreable);
  const { band, bandLabel } = score === null ? { band: null, bandLabel: null } : scoreBandFor(score);

  const groups: GroupScore[] = GROUP_ORDER.map((group) => {
    const members = scored.filter((s) => s.group === group);
    const memberScoreable = members.filter(
      (s): s is ScoredSignal & { index: number } => s.index !== null
    );
    // A group with no scoreable member has nothing to report today — distinct
    // from a group with a mix, which still gets an index from what it has.
    if (memberScoreable.length === 0) return null;
    return { group, label: GROUP_LABELS[group], index: weightedAverage(memberScoreable), signals: members };
  }).filter((g): g is GroupScore => g !== null);

  return { score, band, bandLabel, groups, signals: scored };
}
