import { SCORE_REFERENCES } from "./score-evidence";

/**
 * Evidence for the Sleep Score (sleep-score.ts), reviewed October 2026.
 *
 * SCORE_REFERENCES (score-evidence.ts) already carries "fatigue": Thoret et
 * al.'s sleep-deprivation voice study. Everything else here is new and
 * specific to the sleep question, so it lives in its own reference list
 * rather than growing the main one with citations most of its readers (every
 * sign, not just the sleep-relevant ones) have no reason to see.
 *
 * Every reference below was checked against PubMed for a real PMID before
 * inclusion, the same bar VOICE_BIOMARKER_SOURCES.md sets for the main score.
 * A sleep-adjacent conference abstract (Zhang et al., SLEEP 2024, n=5,
 * acoustic classification of chronic sleep restriction) was found during
 * research for this feature and is deliberately not included here: it had no
 * PubMed-indexed PMID at the time of review and five participants is too
 * small to anchor a product claim, consistent with how this codebase already
 * treats the Warthe aircrew study and the Christodoulides thesis.
 */
export const SLEEP_SCORE_REFERENCES = {
  morningVoice: {
    title: "Icht et al. The “Morning Voice”: The Effect of 24 Hours of Sleep Deprivation on Vocal Parameters of Young Adults. Journal of Voice, 2020.",
    url: "https://pubmed.ncbi.nlm.nih.gov/30527970/",
  },
  fatigueVoiceModel: {
    title: "Gao et al. A rapid, non-invasive method for fatigue detection based on voice information. Frontiers in Cell and Developmental Biology, 2022.",
    url: "https://pubmed.ncbi.nlm.nih.gov/36176279/",
  },
  harmonicNoiseFatigue: {
    title: "Gaur, Kalani and Mohan. Harmonic-to-noise ratio as speech biomarker for fatigue: K-nearest neighbour machine learning algorithm. Medical Journal, Armed Forces India, 2023.",
    url: "https://pubmed.ncbi.nlm.nih.gov/39734876/",
  },
  sleepQualityStressVoice: {
    title: "Carrillo-Gonzalez, Camargo-Mendoza and Cantor-Cutiva. Relationship Between Sleep Quality and Stress with Voice Functioning among College Professors: A Systematic Review and Meta-analysis. Journal of Voice, 2019.",
    url: "https://pubmed.ncbi.nlm.nih.gov/31866075/",
  },
  sleepDebtDefinition: {
    title: "Fox et al. Sleep Debt at the Community Level: Impact of Age, Sex, Race/Ethnicity and Health. Sleep Health, 2018.",
    url: "https://pubmed.ncbi.nlm.nih.gov/30031523/",
  },
  sleepDebtNextDayAffect: {
    title: "Shen et al. Perceived daily sleep need and sleep debt in adolescents: associations with daily affect over school and vacation periods. Sleep, 2021.",
    url: "https://pubmed.ncbi.nlm.nih.gov/34323993/",
  },
  twoProcessModel: {
    title: "Bes. Treatise on an alternative perspective on the two-process model of sleep regulation. npj Biological Timing and Sleep, 2025.",
    url: "https://pubmed.ncbi.nlm.nih.gov/41775810/",
  },
  vigilanceDoseResponse: {
    title: "Van Dongen et al. The cumulative cost of additional wakefulness: dose-response effects on neurobehavioral functions and sleep physiology from chronic sleep restriction and total sleep deprivation. Sleep, 2003.",
    url: "https://pubmed.ncbi.nlm.nih.gov/12683469/",
  },
  consumerTrackerAccuracy: {
    title: "Lee et al. Accuracy of 11 Wearable, Nearable, and Airable Consumer Sleep Trackers: Prospective Multicenter Validation Study. JMIR mHealth and uHealth, 2023.",
    url: "https://pubmed.ncbi.nlm.nih.gov/37917155/",
  },
} as const;

type SleepReferenceId = keyof typeof SLEEP_SCORE_REFERENCES | keyof typeof SCORE_REFERENCES;

/** A referenced id may live in either reference table — this is the one place that matters. */
export function sleepReferenceFor(id: SleepReferenceId): { title: string; url: string } {
  return (SLEEP_SCORE_REFERENCES as Record<string, { title: string; url: string }>)[id]
    ?? (SCORE_REFERENCES as Record<string, { title: string; url: string }>)[id];
}

export interface SleepSignRationale {
  label: string;
  /** Why this sign, specifically, was included in the sleep composite. */
  rationale: string;
  references: SleepReferenceId[];
  basis: "Direct research" | "Related research" | "Physiological rationale";
}

export const SLEEP_MEASUREMENT_RATIONALE: Record<string, SleepSignRationale> = {
  fatigue: {
    label: "Fatigue",
    rationale:
      "Controlled sleep-deprivation studies report changes in prosody, spectral voice quality and harmonics-to-noise ratio after a night of reduced or no sleep.",
    references: ["fatigue", "morningVoice", "fatigueVoiceModel", "harmonicNoiseFatigue"],
    basis: "Direct research",
  },
  stress: {
    label: "Stress",
    rationale:
      "A meta-analysis of teachers found voice disorder prevalence tracked both reported sleep quality and reported work stress, measured together. Separately, cumulative sleep debt measured outside voice research predicts elevated next-day stress-linked affect.",
    references: ["sleepQualityStressVoice", "sleepDebtNextDayAffect"],
    basis: "Related research",
  },
  anxiety: {
    label: "Anxiety",
    rationale:
      "A cross-lagged daily-diary study found cumulative sleep debt predicted higher next-day negative affect at high arousal, the category anxiety sits in. The study measured affect by self-report, not voice.",
    references: ["sleepDebtNextDayAffect"],
    basis: "Related research",
  },
  "mood-disruption": {
    label: "Mood disruption",
    rationale:
      "The same sleep-debt and next-day-affect research applies here: cumulative sleep debt predicted lower next-day positive affect as well as higher negative affect. Mood disruption is Serasona's own voice-derived sign for a related but not identical construct.",
    references: ["sleepDebtNextDayAffect"],
    basis: "Related research",
  },
  "emotional-destabilization": {
    label: "Emotional destabilization",
    rationale:
      "A model-internal sign (see score-evidence.ts). Included here on the same next-day-affect sleep-debt research as mood and anxiety above, since emotional destabilization sits in the same affective territory.",
    references: ["sleepDebtNextDayAffect"],
    basis: "Related research",
  },
  "cognitive-load": {
    label: "Cognitive load",
    rationale:
      "A landmark dose-response study found cumulative sleep restriction produces a progressive, measurable decline in sustained attention and reaction-time performance.",
    references: ["vigilanceDoseResponse"],
    basis: "Related research",
  },
  "attention-dysregulation": {
    label: "Attention dysregulation",
    rationale:
      "Same vigilance dose-response research as cognitive load: sleep restriction's best-established cognitive effect is a decline in sustained attention, which is what this sign targets.",
    references: ["vigilanceDoseResponse"],
    basis: "Related research",
  },
  "cognitive-impairment": {
    label: "Cognitive impairment pattern",
    rationale:
      "Sleep restriction's effect on sustained attention and reaction time is well established outside voice research.",
    references: ["vigilanceDoseResponse"],
    basis: "Related research",
  },
  "cardiovascular-strain": {
    label: "Cardiovascular strain",
    rationale:
      "Chronic short sleep is an established cardiovascular risk factor in the sleep medicine literature.",
    references: ["sleepDebtDefinition"],
    basis: "Physiological rationale",
  },
  "elevated-blood-pressure": {
    label: "Blood pressure pattern",
    rationale:
      "Reduced sleep is associated with higher blood pressure in sleep medicine research.",
    references: ["sleepDebtDefinition"],
    basis: "Physiological rationale",
  },
  "metabolic-load": {
    label: "Metabolic load",
    rationale:
      "Sleep restriction is associated with metabolic and appetite-regulatory changes in sleep medicine research.",
    references: ["sleepDebtDefinition"],
    basis: "Physiological rationale",
  },
};
