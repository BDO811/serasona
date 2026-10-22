import type { StoredSession } from "./voice-history-client";
import { isUsableSession } from "./dashboard-data";
import { computeSerasonaScore } from "./serasona-score";

const LABELS = ["Latest", "Previous", "Earlier"];

/** The three most recently captured scored check-ins, newest first. Ranked by recency alone, never bucketed by calendar day, so three readings taken in one day fill all three slots and a day with nothing recorded is simply skipped. Never averaged. */
export function lastThreeMeasurements(sessions: StoredSession[], now = Date.now()) {
  const scored = sessions
    .filter((session) => session.capturedAt <= now && isUsableSession(session))
    .map((session) => ({ session, result: computeSerasonaScore(session.signals) }))
    .filter((entry) => entry.result?.score != null)
    .sort((a, b) => b.session.capturedAt - a.session.capturedAt)
    .slice(0, 3);

  return [0, 1, 2].map((index) => {
    const entry = scored[index];
    return {
      label: LABELS[index],
      capturedAt: entry?.session.capturedAt ?? null,
      session: entry?.session,
      score: entry?.result.score ?? null,
      band: entry?.result.bandLabel ?? null,
    };
  });
}
