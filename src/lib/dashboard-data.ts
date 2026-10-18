import { computeSerasonaScore, type ScoreGroup } from "./serasona-score";
import type { StoredSession } from "./voice-history-client";

export type DashboardMetric = "overall" | ScoreGroup;
export const sourceLabel = (session: StoredSession) => session.source === "phone" ? "Phone" : session.source === "browser" ? "Browser" : "Not recorded";
export const isUsableSession = (session: StoredSession) => (!session.status || session.status === "complete") && session.quality?.usable !== false && session.signals.length > 0;
export function metricValue(session: StoredSession, metric: DashboardMetric) {
  if (!isUsableSession(session)) return null;
  const result = computeSerasonaScore(session.signals);
  return metric === "overall" ? result?.score ?? null : result?.groups.find((group) => group.group === metric)?.index ?? null;
}
/** Same source, model and returned signal coverage only. Never blend calls and browser audio. */
export function cohortKey(session: StoredSession) {
  return JSON.stringify([session.source || "unknown", session.model, computeSerasonaScore(session.signals)?.coverageKey, computeSerasonaScore(session.signals)?.version]);
}
export function dashboardSessions(sessions: StoredSession[], days: number, source: string, now = Date.now()) {
  const cutoff = now - days * 86400000;
  return sessions.filter((session) => session.capturedAt >= cutoff && session.capturedAt <= now && (source === "all" || (session.source || "unknown") === source)).sort((a, b) => a.capturedAt - b.capturedAt);
}
export function comparableSessions(sessions: StoredSession[], reference: StoredSession | undefined) {
  return reference ? sessions.filter((session) => isUsableSession(session) && cohortKey(session) === cohortKey(reference)) : [];
}
