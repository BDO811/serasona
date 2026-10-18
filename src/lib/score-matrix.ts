import { MODELS, ADDON_MODELS, planIncludes } from "./models";
import { SIGN_DEFINITIONS } from "./serasona-score";
import type { PlanId } from "@/context/AuthContext";

/** Canonical API names corresponding to the public model catalogue. */
export const MODEL_SIGN_NAMES: Record<string, string[]> = {
  pulse: ["mood-disruption", "anxiety", "stress", "fatigue", "dehydration", "elevated-blood-pressure"],
  haven: ["hypervigilance", "attention-dysregulation", "mood-disruption", "anxiety", "stress", "fatigue"],
  apex: ["cardiovascular-strain", "cognitive-load", "head-impact", "dehydration", "fatigue", "stress", "anxiety"],
  tide: ["metabolic-load", "elevated-blood-pressure", "iron-deficiency", "dehydration", "dry-mouth", "fatigue"],
  aria: ["elevated-androgens", "iron-deficiency", "mood-disruption", "elevated-blood-pressure", "dehydration", "fatigue", "anxiety"],
  breath: ["airway-obstruction-pattern", "allergy"],
  clarity: ["cognitive-impairment"],
  harbor: ["alcohol-use-pattern", "substance-use-pattern", "emotional-destabilization", "anxiety", "stress", "fatigue"],
};

/** Mirrors the currently enforced backend model allowance. Available is not measured. */
export function scoreMatrixForPlan(plan: PlanId) {
  const ids = ["pulse", ...ADDON_MODELS.slice(0, planIncludes(plan)).map((model) => model.id)];
  return ids.map((id) => ({
    model: MODELS.find((model) => model.id === id)!,
    signs: MODEL_SIGN_NAMES[id].map((name) => ({ name, ...SIGN_DEFINITIONS[name] })),
  }));
}
