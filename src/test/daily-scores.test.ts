import { describe, expect, it } from "vitest";
import { lastThreeDailyScores } from "@/lib/daily-scores";
import type { StoredSession } from "@/lib/voice-history-client";
const now = new Date(2026, 9, 18, 16).getTime();
function session(id: string, day: number, hour: number, level = "moderate"): StoredSession { return { sessionId: id, capturedAt: new Date(2026, 9, day, hour).getTime(), source: "browser", model: "pulse", pathway: "WELLNESS", summary: null, signals: [{ name: "stress", label: "Stress", score: .4, level, flagged: true }] }; }
describe("last three daily Serasona scores", () => {
  it("uses the latest scored recording per local calendar day without averaging", () => {
    const days = lastThreeDailyScores([session("morning",18,8,"low"),session("latest",18,12),session("yesterday",17,23,"consider"),session("older",16,0,"low"),session("outside",15,22)],now);
    expect(days.map((day) => day.session?.sessionId)).toEqual(["latest","yesterday","older"]);
    expect(days.map((day) => day.score)).toEqual([38,68,100]);
  });
  it("leaves missing days empty and excludes future or failed recordings", () => {
    const days = lastThreeDailyScores([session("old",16,12),session("future",18,20),{...session("failed",17,12),status:"failed"}],now);
    expect(days.map((day) => day.score)).toEqual([null,null,38]);
    expect(days[0].hasRecordings).toBe(false); expect(days[1].hasRecordings).toBe(true);
  });
  it("does not substitute sample trends or older readings for inconclusive days", () => {
    const days = lastThreeDailyScores([session("none",18,12,"inconclusive"),session("too-old",14,12)],now);
    expect(days).toHaveLength(3);expect(days.every((day) => day.score === null)).toBe(true);expect(days[0].hasRecordings).toBe(true);
  });
});
