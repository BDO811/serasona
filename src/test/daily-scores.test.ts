import { describe, expect, it } from "vitest";
import { lastThreeMeasurements } from "@/lib/daily-scores";
import type { StoredSession } from "@/lib/voice-history-client";
const now = new Date(2026, 9, 18, 16).getTime();
function session(id: string, day: number, hour: number, level = "moderate"): StoredSession { return { sessionId: id, capturedAt: new Date(2026, 9, day, hour).getTime(), source: "browser", model: "pulse", pathway: "WELLNESS", summary: null, signals: [{ name: "stress", label: "Stress", score: .4, level, flagged: true }] }; }
describe("last three measurements", () => {
  it("ranks the three most recently captured scored readings by recency, not by calendar day", () => {
    const measurements = lastThreeMeasurements([session("morning",18,8,"low"),session("latest",18,12),session("yesterday",17,23,"consider"),session("older",16,0,"low"),session("outside",15,22)],now);
    expect(measurements.map((m) => m.session?.sessionId)).toEqual(["latest","morning","yesterday"]);
    expect(measurements.map((m) => m.score)).toEqual([38,100,68]);
  });
  it("fills every slot from one day when that day has three or more readings", () => {
    const measurements = lastThreeMeasurements([session("a",18,9),session("b",18,12),session("c",18,15),session("d",17,9)],now);
    expect(measurements.map((m) => m.session?.sessionId)).toEqual(["c","b","a"]);
  });
  it("leaves trailing slots empty and excludes future-dated or failed recordings", () => {
    const measurements = lastThreeMeasurements([session("old",16,12),session("future",18,20),{...session("failed",17,12),status:"failed"}],now);
    expect(measurements.map((m) => m.score)).toEqual([38,null,null]);
    expect(measurements[0].session?.sessionId).toBe("old");
    expect(measurements[1].session).toBeUndefined();
  });
  it("excludes inconclusive and unscored recordings from every slot", () => {
    const measurements = lastThreeMeasurements([session("none",18,12,"inconclusive")],now);
    expect(measurements).toHaveLength(3);
    expect(measurements.every((m) => m.score === null)).toBe(true);
  });
});
