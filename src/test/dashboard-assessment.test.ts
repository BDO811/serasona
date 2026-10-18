import { describe, expect, it } from "vitest";
import { assessmentForSession } from "@/lib/dashboard-assessment";
import type { StoredSession } from "@/lib/voice-history-client";
const session = (levels: string[]): StoredSession => ({ sessionId: "record", capturedAt: 1, source: "browser", model: "pulse", pathway: "WELLNESS", summary: null, signals: levels.map((level, i) => ({ name: `sign-${i}`, label: `Sign ${i}`, score: .5, level, flagged: false })) });
describe("dashboard assessment report parity", () => {
  it("grades returned bands and counts flags rather than trusting stale summary totals", () => {
    const result = assessmentForSession({ ...session(["low", "consider", "moderate", "consider", "moderate", "consider"]), summary: { overallLevel: "low", recommendedAction: null, flaggedCount: 0, totalSignals: 99 } });
    expect(result).toMatchObject({ flaggedCount: 5, rung: "steady", profileLabel: "MEDIUM", title: "Wellness" });
  });
  it("applies the same per-sign overrides as the report", () => {
    const s = session(["consider", "low"]); s.signals[0].name = "head-impact";
    expect(assessmentForSession(s).flaggedCount).toBe(0);
    expect(assessmentForSession(s).rung).toBe("clean");
  });
  it("does not claim an optimal result for missing, failed or inconclusive recordings", () => {
    expect(assessmentForSession().rung).toBe("unreadable");
    expect(assessmentForSession(session(["inconclusive"])).rung).toBe("unreadable");
    expect(assessmentForSession({ ...session(["low"]), status: "failed" }).rung).toBe("unreadable");
  });
});
