import type { StoredSession } from "./voice-history-client";
import { bandForSignal, isFlaggedBand } from "./signal-band";
import { rungFor, RUNG_SCALE } from "./result-headline";
import { isUsableSession } from "./dashboard-data";

/** Same displayed-band grading as the full report, including per-sign overrides. */
export function assessmentForSession(session?: StoredSession) {
  const signals = session && isUsableSession(session) ? session.signals : [];
  const bands = signals.map((s) => bandForSignal(s.name, s.level, s.score));
  const rung = rungFor({ levels: signals.map((s, i) => bands[i] === "NORMAL" ? "low" : s.level || "") });
  const titles: Record<string, string> = { WELLNESS: "Wellness", BRAIN_AGE: "Cognitive", LONGEVITY: "Longevity", MENTAL_HEALTH: "Mental health", FERTILITY: "Fertility", SPORTS: "Sports" };
  return { rung, profileLabel: RUNG_SCALE.find((r) => r.key === rung)?.label ?? "Inconclusive", flaggedCount: bands.filter(isFlaggedBand).length, title: titles[session?.pathway] || "Voice" };
}
