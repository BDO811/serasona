import { describe, expect, it } from "vitest";
import { computeClarityScore } from "@/lib/clarity-score";
import { computeSerasonaScore, type ScorableSignal } from "@/lib/serasona-score";
import { metricValue, cohortKey } from "@/lib/dashboard-data";
import { trendReadings } from "@/lib/dashboard-trends";
import type { StoredSession } from "@/lib/voice-history-client";

const signal = (name: string, level = "none", score = .2): ScorableSignal => ({ name, label: name, level, score });
const pulse = [signal("fatigue", "moderate"), signal("stress"), signal("anxiety"), signal("mood-disruption"), signal("dehydration"), signal("elevated-blood-pressure")];
const session = (signals = pulse): StoredSession => ({ sessionId: "pulse-reading", capturedAt: Date.now(), source: "browser", model: "pulse", pathway: "WELLNESS", summary: null, signals: signals.map((s) => ({ ...s, level: s.level || "inconclusive", flagged: false })) });

describe("Clarity mental readiness composite", () => {
  it("scores ordinary Pulse readings using the documented weighted formula", () => {
    const result = computeClarityScore(pulse)!;
    expect(result.score).toBe(71);
    expect(result.bandLabel).toBe("Clear");
    expect(result.coverageKey).toBe("anxiety,fatigue,mood-disruption,stress");
    expect(computeClarityScore([signal("fatigue")])?.score).toBe(100);
    expect(computeClarityScore([signal("fatigue", "elevated")])?.score).toBe(8);
  });
  it("accepts dedicated cognitive signs and deduplicates them", () => {
    const cognitive = signal("cognitive-impairment", "moderate");
    expect(computeClarityScore([cognitive, cognitive])?.score).toBe(38);
    expect(computeClarityScore([signal("attention-dysregulation"), signal("cognitive-load", "elevated", .97)])?.score).toBe(54);
  });
  it("excludes unreadable and invalid inputs and never invents a cognitive input", () => {
    for (const signals of [[], [signal("stress")], [signal("dehydration")], [signal("fatigue", "inconclusive")], [signal("fatigue", "none", NaN)], [signal("fatigue", "none", 2)], [signal("unknown")]]) {
      expect(computeClarityScore(signals)).toBeNull();
    }
    expect(computeClarityScore([signal("fatigue"), signal("stress", "inconclusive")])?.score).toBe(100);
  });
  it("populates saved cards, tables and trend points through the same calculation", () => {
    const reading = session();
    expect(metricValue(reading, "clarity")).toBe(71);
    expect(trendReadings([reading])[0].clarity).toBe(71);
    expect(metricValue({ ...reading, status: "failed" }, "clarity")).toBeNull();
    expect(metricValue({ ...reading, quality: { usable: false } }, "clarity")).toBeNull();
    expect(cohortKey(reading)).toContain("serasona-clarity-1");
    // Secondary indices do not double-count their inputs in the main score.
    expect(metricValue(reading, "overall")).toBe(computeSerasonaScore(pulse)?.score);
  });
});
