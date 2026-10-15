/**
 * Which body-map icon each real Amplifier signal, sub-dimension, and lab
 * metric belongs under.
 *
 * Every signal name across every v2 model is listed explicitly (see the model
 * registry comment in pathway-model-map.ts) rather than left to a fallback, so
 * a signal never lands in a zone nobody chose. Sub-dimensions are split
 * between BRAIN (the cognitive/attentional ones) and CORE (the five that read
 * as a body-wide energy state rather than a head-specific one - see
 * CORE_SUBDIMENSION_IDS below). Lab metrics are vocal/acoustic by
 * construction; the two breath-specific ones go to LUNGS, the rest to MOUTH.
 */

export type BodyZone = "brain" | "mouth" | "heart" | "core" | "lungs" | "blood";

export const BODY_ZONES: BodyZone[] = ["brain", "mouth", "heart", "core", "lungs", "blood"];

export const BODY_ZONE_LABEL: Record<BodyZone, string> = {
  brain: "Brain",
  mouth: "Mouth",
  heart: "Heart",
  core: "Core",
  lungs: "Lungs",
  blood: "Blood",
};

/**
 * Every signal name the v2 model registry documents, from every pathway
 * (pulse, clarity, haven, tide, aria, apex — breath and harbor are not wired
 * to a pathway today, so their sign lists are not published, and nothing here
 * depends on them).
 */
const SIGNAL_ZONE: Record<string, BodyZone> = {
  // Mental / cognitive
  "mood-disruption": "brain",
  anxiety: "brain",
  stress: "brain",
  fatigue: "brain",
  "cognitive-impairment": "brain",
  hypervigilance: "brain",
  "attention-dysregulation": "brain",
  "cognitive-load": "brain",
  "head-impact": "brain",
  // Cardiovascular
  "elevated-blood-pressure": "heart",
  "cardiovascular-strain": "heart",
  // Mouth
  "dry-mouth": "mouth",
  dehydration: "mouth",
  // Blood / metabolic / hormonal
  "iron-deficiency": "blood",
  "elevated-androgens": "blood",
  "metabolic-load": "blood",
};

/**
 * A signal name this build has not seen goes to Brain: most Amplifier signals
 * are mental/cognitive reads, so it is the least-wrong default, and a signal
 * landing in the wrong group is a display issue, not a data one — bandForSignal
 * and the flag count are unaffected either way.
 */
export function zoneForSignal(name: string | null | undefined): BodyZone {
  const key = (name || "").toLowerCase();
  return SIGNAL_ZONE[key] ?? "brain";
}

/**
 * The five sub-dimensions (see sub-dimensions.ts) that read as a body-wide
 * energy state - recovery, energy, vitality, freshness, composure - land on
 * the core marker instead of the head. The rest (happiness/anhedonia, focus,
 * drive) are specifically cognitive/attentional and stay on brain.
 */
const CORE_SUBDIMENSION_IDS = new Set([
  "sleep-disturbance",
  "fatigue",
  "energy-level",
  "burnout",
  "psychomotor-state",
]);

export function zoneForSubDimension(metricId: string): BodyZone {
  return CORE_SUBDIMENSION_IDS.has(metricId) ? "core" : "brain";
}

/** LabMetric.label strings that read as breath rather than vocal cord/articulation. */
const LUNGS_LAB_LABELS = new Set(["PAUSE", "BREATHINESS"]);

/**
 * Every other lab metric (pitch, loudness, speech rate, jitter, shimmer, HNR,
 * ...) is a vocal-tract measurement, so Mouth is the default rather than a
 * named list that would need updating each time a new acoustic feature ships.
 */
export function zoneForLabMetric(label: string | null | undefined): BodyZone {
  const key = (label || "").toUpperCase();
  return LUNGS_LAB_LABELS.has(key) ? "lungs" : "mouth";
}
