import type { StoredSession } from "./voice-history-client";
import { isUsableSession } from "./dashboard-data";
import { computeSerasonaScore } from "./serasona-score";

/** Three local calendar days, newest first. Never average across models or fill missing days. */
export function lastThreeDailyScores(sessions: StoredSession[], now = Date.now()) {
  return [0, 1, 2].map((offset) => {
    const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - offset);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const readings = sessions.filter((session) => session.capturedAt >= start.getTime() && session.capturedAt < end.getTime() && session.capturedAt <= now);
    const scored = readings.filter(isUsableSession).map((session) => ({ session, result: computeSerasonaScore(session.signals) })).filter((entry) => entry.result?.score != null).sort((a, b) => b.session.capturedAt - a.session.capturedAt);
    return { date: start.getTime(), label: offset === 0 ? "Today" : offset === 1 ? "Yesterday" : start.toLocaleDateString(undefined, { weekday: "long" }), session: scored[0]?.session, score: scored[0]?.result.score ?? null, band: scored[0]?.result.bandLabel ?? null, hasRecordings: readings.length > 0 };
  });
}
