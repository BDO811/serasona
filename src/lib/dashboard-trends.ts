import type { StoredSession } from "./voice-history-client";
import { isUsableSession, metricValue } from "./dashboard-data";
export const TREND_SERIES = [
  { key: "stress", label: "Stress index", color: "#D12B26" },
  { key: "wellness", label: "Wellness index", color: "#177A4B" },
  { key: "clarity", label: "Clarity index", color: "#2F5BEA" },
] as const;
export type TrendMetric = "all" | typeof TREND_SERIES[number]["key"];
export interface TrendReading { capturedAt: number; stress: number | null; wellness: number | null; clarity: number | null }
/** Display-only samples. Never passed into history saving or the score calculation. */
export function sampleTrendReadings(now = Date.now()): TrendReading[] {
  const stress = [42, 48, 45, 55, 51, 60, 58, 65, 61, 68];
  const wellness = [55, 52, 60, 57, 64, 62, 68, 66, 74, 72];
  const clarity = [68, 72, 70, 77, 74, 80, 76, 84, 81, 87];
  return stress.map((value, i) => { const date = new Date(now); date.setDate(date.getDate() - (9 - i)); date.setHours(12, 0, 0, 0); return { capturedAt: date.getTime(), stress: value, wellness: wellness[i], clarity: clarity[i] }; });
}
/** Caller supplies a compatible source/model/coverage cohort. */
export function trendReadings(sessions: StoredSession[]): TrendReading[] {
  return sessions.filter(isUsableSession).slice().sort((a, b) => a.capturedAt - b.capturedAt).slice(-10).map((session) => ({ capturedAt: session.capturedAt, stress: metricValue(session, "stress"), wellness: metricValue(session, "wellness"), clarity: metricValue(session, "clarity") }));
}
