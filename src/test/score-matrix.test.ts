import { describe, expect, it } from "vitest";
import { MODEL_SIGN_NAMES, scoreMatrixForPlan } from "@/lib/score-matrix";
import { MODELS } from "@/lib/models";
import { SIGN_DEFINITIONS } from "@/lib/serasona-score";
import { cohortKey } from "@/lib/dashboard-data";
import type { StoredSession } from "@/lib/voice-history-client";

describe("level measurement matrix", () => {
  it("covers every catalogue model and sign with an explicit positive weight", () => {
    for (const model of MODELS) {
      expect(MODEL_SIGN_NAMES[model.id]).toHaveLength(model.signs.length);
      for (const name of MODEL_SIGN_NAMES[model.id]) expect(SIGN_DEFINITIONS[name]?.weight).toBeGreaterThan(0);
    }
  });
  it("matches server plan allowances without assuming available models ran", () => {
    expect(scoreMatrixForPlan("free").map((row) => row.model.id)).toEqual(["pulse"]);
    expect(scoreMatrixForPlan("core")).toHaveLength(1);
    expect(scoreMatrixForPlan("plus").map((row) => row.model.id)).toEqual(["pulse", "haven", "apex", "tide"]);
    expect(scoreMatrixForPlan("executive")).toHaveLength(8);
  });
  it("starts a new comparison when a previously scored sign becomes inconclusive", () => {
    const session: StoredSession = { sessionId: "a", capturedAt: 1, source: "browser", model: "pulse", pathway: null, summary: null, signals: [{ name: "stress", label: "Stress", score: .2, level: "none", flagged: false }] };
    expect(cohortKey(session)).not.toBe(cohortKey({ ...session, signals: [{ ...session.signals[0], level: "inconclusive" }] }));
  });
});
