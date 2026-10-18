import { describe, it, expect } from "vitest";
import { comparableSessions, dashboardSessions, metricValue } from "@/lib/dashboard-data";
import type { StoredSession } from "@/lib/voice-history-client";
const now = Date.now();
const session = (id: string, patch: Partial<StoredSession> = {}): StoredSession => ({ sessionId: id, capturedAt: now, source: "browser", model: "haven", pathway: "WELLNESS", signals: [{ name: "stress", label: "Stress", score: .2, level: "low", flagged: false }], summary: null, ...patch });
describe("live dashboard cohorts", () => {
  it("orders dates and filters real periods and sources", () => {
    const earlier = session("a", { capturedAt: now - 86400000 });
    const latest = session("b");
    expect(dashboardSessions([latest, session("old", { capturedAt: now - 40 * 86400000 }), earlier, session("call", { source: "phone" })], 7, "browser", now).map((s) => s.sessionId)).toEqual(["a", "b"]);
  });
  it("never blends phone, browser, different models or coverage", () => {
    const browser = session("a");
    expect(comparableSessions([browser, session("call", { source: "phone" }), session("other-model", { model: "pulse" }), session("coverage", { signals: [] })], browser)).toEqual([browser]);
  });
  it("does not fabricate groups or score unsuccessful recordings", () => {
    expect(metricValue(session("a"), "clarity")).toBeNull();
    expect(metricValue(session("failed", { status: "failed" }), "overall")).toBeNull();
    expect(metricValue(session("bad", { quality: { usable: false } }), "stress")).toBeNull();
    expect(metricValue(session("none", { signals: [{ name: "stress", label: "Stress", score: .2, flagged: false, level: "inconclusive" }] }), "stress")).toBeNull();
  });
});
