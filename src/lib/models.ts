import type { PlanId } from "@/context/AuthContext";

/**
 * The model catalogue, and what it costs to add one.
 *
 * Every check-in is a single twenty-second recording. Each model reads that
 * same recording for something different, which is why adding one costs a few
 * dollars rather than requiring another check-in.
 *
 * The signs listed against each model are the ones the API actually returns
 * for it — they are not aspirational. If a sign is not in this list, the model
 * does not report it.
 */

export interface VoiceModel {
  id: string;
  name: string;
  /** One line, consumer-facing: what this model is for. */
  tagline: string;
  /** A paragraph. What it reads, and who would actually want it. */
  body: string;
  /** Exactly the signs the API returns for this model, in plain language. */
  signs: string[];
  /** Bone neutral only — color is reserved for status (steady/info/alert) elsewhere in the product. */
  tone: string;
  /** Background photo under the card header. */
  image: string;
  /**
   * Shown on the card where the published evidence is unusually strong or
   * unusually thin. Left undefined where it is simply ordinary.
   */
  evidence?: { strength: "strong" | "limited"; note: string };
  /** Models that need their own consent step before they can be enabled. */
  sensitive?: string;
  /** Included with the base subscription rather than sold as an add-on. */
  included?: boolean;
}

export const MODELS: VoiceModel[] = [
  {
    id: "pulse",
    name: "Pulse",
    tagline: "Everyday wellness",
    body: "The baseline read, and the one every plan includes. Pulse is what answers the question you actually asked when you opened the app: how am I doing today, and is that different from yesterday.",
    signs: ["Mood", "Anxiety", "Stress", "Fatigue", "Hydration", "Blood pressure"],
    tone: "#111111",
    image: "models/pulse.jpg",
    included: true,
  },
  {
    id: "haven",
    name: "Haven",
    tagline: "Mental and behavioural health",
    body: "Where Pulse gives you one reading for mood, Haven separates it out. It adds hypervigilance and attention dysregulation, which move independently of stress and tend to be the first things to shift when something is building.",
    signs: ["Hypervigilance", "Attention dysregulation", "Mood disruption", "Anxiety", "Stress", "Fatigue"],
    tone: "#2B2926",
    image: "models/haven.jpg",
  },
  {
    id: "apex",
    name: "Apex",
    tagline: "Performance and strain",
    body: "Built around training load rather than mood. Apex reads cardiovascular strain and cognitive load together, which is the combination that tells you whether a hard week is being absorbed or is starting to cost you.",
    signs: ["Cardiovascular strain", "Cognitive load", "Head impact", "Hydration", "Fatigue", "Stress", "Anxiety"],
    tone: "#4A4741",
    image: "models/apex.jpg",
  },
  {
    id: "tide",
    name: "Tide",
    tagline: "Cardiometabolic",
    body: "The slower-moving signals. These shift over weeks rather than hours, so Tide is the model that rewards a long run of check-ins more than any single one.",
    signs: ["Metabolic load", "Blood pressure", "Iron deficiency", "Hydration", "Dry mouth", "Fatigue"],
    tone: "#111111",
    image: "models/tide.jpg",
  },
  {
    id: "aria",
    name: "Aria",
    tagline: "Women's health",
    body: "Reads hormonal and iron-related patterns alongside the usual wellness signals. Aria is the one model here built for a specific physiology rather than for everyone, so it is off unless you turn it on.",
    signs: ["Elevated androgens", "Iron deficiency", "Mood disruption", "Blood pressure", "Hydration", "Fatigue", "Anxiety"],
    tone: "#2B2926",
    image: "models/aria.jpg",
  },
  {
    id: "breath",
    name: "Breath",
    tagline: "Respiratory",
    body: "Listens to the airway rather than the speaker. Breath reads obstruction patterns and allergy response from how air moves through a sentence.",
    signs: ["Airway obstruction pattern", "Allergy"],
    tone: "#4A4741",
    image: "models/breath.jpg",
    evidence: {
      strength: "strong",
      note: "Respiratory audio has the strongest published evidence of anything in this catalogue: a systematic review of 81 studies found 60 to 100% reported accuracy across asthma, COPD and infectious disease.",
    },
  },
  {
    id: "clarity",
    name: "Clarity",
    tagline: "Cognitive",
    body: "A single signal, tracked against your own baseline over months rather than read day to day. Clarity is only meaningful as a long trend, which is why it is the model that most rewards patience.",
    signs: ["Cognitive impairment pattern"],
    tone: "#111111",
    image: "models/clarity.jpg",
    evidence: {
      strength: "limited",
      note: "The published evidence here is the thinnest in the catalogue. A systematic review of cognitive load and voice found only nine qualifying studies and no consistent acoustic pattern. Treat this as directional, and as a prompt to talk to a clinician rather than an answer.",
    },
  },
  {
    id: "harbor",
    name: "Harbor",
    tagline: "Recovery",
    body: "For anyone staying on track and wanting an objective read on it. Harbor adds emotional destabilization, which tends to move before the patterns it sits alongside.",
    signs: ["Alcohol use pattern", "Substance use pattern", "Emotional destabilization", "Anxiety", "Stress", "Fatigue"],
    tone: "#2B2926",
    image: "models/harbor.jpg",
    sensitive:
      "Harbor infers alcohol and substance-use patterns and stores the result against your account. That is a different category of personal information from the rest of this catalogue, so enabling it takes its own explicit consent and it can be deleted on its own.",
  },
];

export const ADDON_MODELS = MODELS.filter((m) => !m.included);

/**
 * Add-ons are a flat price per model, deliberately.
 *
 * An earlier version discounted them as you added more, which read as
 * generous and quietly competed with the plans: buying three models a la
 * carte came out cheaper than Plus, so the upgrade people should have taken
 * was the worse deal. A flat price keeps a la carte honest for someone who
 * genuinely wants one extra model, and lets every plan above Core beat it
 * outright on anything more.
 */
export const ADDON_PRICE_CENTS = 499;

export const addonPriceCents = (count: number) => Math.max(count, 0) * ADDON_PRICE_CENTS;

/** Same thing now, but kept so callers reading "list price" still make sense. */
export const addonListPriceCents = addonPriceCents;

/** What this many models would cost on Core, one at a time. */
export const alaCarteTotalCents = (count: number, baseCents = 799) =>
  baseCents + addonPriceCents(count);

export const money = (cents: number) =>
  `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

/**
 * How many add-on models each plan includes before you start paying extra.
 *
 * Plus includes three rather than two so that its window is wide. At two it
 * was the cheapest option for exactly one basket size, which is not enough
 * room for a plan to be an obvious choice.
 */
export const PLAN_INCLUDED_MODELS: Record<PlanId, number> = {
  free: 0,
  core: 0,
  plus: 3,
  executive: ADDON_MODELS.length,
};

/** Monthly plan prices, for showing what a basket would cost each way. */
export const PLAN_PRICE_CENTS: Record<PlanId, number> = {
  free: 0,
  core: 799,
  plus: 1499,
  executive: 1999,
};

/**
 * The cheapest way to get this many add-on models, and what it saves against
 * buying them one at a time on Core. This is what the catalogue uses to tell
 * someone they are about to overpay.
 */
export function bestPlanFor(count: number): {
  plan: PlanId;
  totalCents: number;
  alaCarteCents: number;
  savingCents: number;
} {
  const options: PlanId[] = ["core", "plus", "executive"];
  const cost = (p: PlanId) =>
    PLAN_PRICE_CENTS[p] + addonPriceCents(Math.max(count - PLAN_INCLUDED_MODELS[p], 0));

  const plan = options.reduce((best, p) => (cost(p) < cost(best) ? p : best), "core" as PlanId);
  const alaCarteCents = cost("core");
  return {
    plan,
    totalCents: cost(plan),
    alaCarteCents,
    savingCents: alaCarteCents - cost(plan),
  };
}

export const planIncludes = (plan: PlanId) => PLAN_INCLUDED_MODELS[plan] ?? 0;
