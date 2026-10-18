import { describe, expect, it } from "vitest";
import { sampleTrendReadings, trendReadings } from "@/lib/dashboard-trends";
import type { StoredSession } from "@/lib/voice-history-client";
describe("ten-measurement dashboard trends", () => {
  it("provides ten distinct dated preview measurements independently of saved results", () => {
    const points = sampleTrendReadings(new Date(2026, 9, 18, 17).getTime());
    expect(points).toHaveLength(10); expect(new Set(points.map((p) => p.capturedAt)).size).toBe(10);
    expect(new Date(points[9].capturedAt).getDate()).toBe(18);
    expect(points.every((point) => [point.stress, point.wellness, point.clarity].every((v) => v >= 0 && v <= 100))).toBe(true);
  });
  it("uses the last ten real readings, preserves missing groups, and never changes saved records", () => {
    const sessions: StoredSession[] = Array.from({ length: 12 }, (_, i) => ({ sessionId: `${i}`, capturedAt: i, model: "pulse", pathway: "WELLNESS", source: "browser", summary: null, signals: [{ name: "stress", label: "Stress", score: .5, level: "moderate", flagged: true }] }));
    const before = JSON.stringify(sessions); const points = trendReadings([...sessions].reverse());
    expect(points).toHaveLength(10); expect(points[0].capturedAt).toBe(2); expect(points[9].capturedAt).toBe(11);
    expect(points.every((point) => point.wellness === null && point.clarity === null)).toBe(true);
    expect(JSON.stringify(sessions)).toBe(before); expect(trendReadings([])).toEqual([]);
  });
});
