import { describe, expect, it } from "vitest";
import { computeSleepScore, SLEEP_SIGN_WEIGHTS } from "@/lib/sleep-score";
import type { ScorableSignal } from "@/lib/serasona-score";
import { SLEEP_MEASUREMENT_RATIONALE, SLEEP_SCORE_REFERENCES, sleepReferenceFor } from "@/lib/sleep-score-evidence";

/** The real pulse+apex sample from PanelPreview.tsx, same fixture serasona-score.test.ts uses. */
const LIVE_SIGNALS: ScorableSignal[] = [
  { name: "fatigue", label: "Fatigue", score: 0.318, level: "consider" },
  { name: "stress", label: "Stress", score: 0.284, level: "consider" },
  { name: "anxiety", label: "Anxiety", score: 0.512, level: "moderate" },
  { name: "head-impact", label: "Head Impact", score: 0.14, level: "low" },
  { name: "elevated-blood-pressure", label: "Elevated Blood Pressure", score: 0.308, level: "low" },
];

describe("computeSleepScore", () => {
  it("returns null for no signals", () => {
    expect(computeSleepScore(undefined)).toBeNull();
    expect(computeSleepScore([])).toBeNull();
  });

  it("returns null when nothing returned is in the sleep-relevant set", () => {
    // head-impact is a real sign, just not one this composite reads.
    const result = computeSleepScore([{ name: "head-impact", label: "Head Impact", score: 0.14, level: "low" }]);
    expect(result).toBeNull();
  });

  it("reads only the sleep-relevant subset out of a mixed recording", () => {
    // LIVE_SIGNALS has 5 signs; only fatigue, stress, anxiety and
    // elevated-blood-pressure are sleep-relevant — head-impact is excluded.
    const result = computeSleepScore(LIVE_SIGNALS)!;
    expect(result).not.toBeNull();
    const names = result.signals.map((s) => s.name).sort();
    expect(names).toEqual(["anxiety", "elevated-blood-pressure", "fatigue", "stress"]);
  });

  it("every key in SLEEP_SIGN_WEIGHTS has rationale and is a real catalogue sign", () => {
    for (const name of Object.keys(SLEEP_SIGN_WEIGHTS)) {
      expect(SLEEP_MEASUREMENT_RATIONALE[name], `missing rationale for "${name}"`).toBeDefined();
      for (const refId of SLEEP_MEASUREMENT_RATIONALE[name].references) {
        expect(sleepReferenceFor(refId), `missing reference "${refId}" for "${name}"`).toBeDefined();
      }
    }
  });

  it("anxiety at 'moderate' pulls the composite below a perfect 100", () => {
    const result = computeSleepScore(LIVE_SIGNALS)!;
    const anxiety = result.signals.find((s) => s.name === "anxiety")!;
    expect(anxiety.displayBand).toBe("MODERATE");
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeLessThan(100);
  });

  it("elevated-blood-pressure only flags at ELEVATED, so 'low' composites as NORMAL here too", () => {
    // Confirms the sleep composite reuses bandForSignal's per-sign overrides
    // rather than re-deriving its own banding.
    const result = computeSleepScore(LIVE_SIGNALS)!;
    const bp = result.signals.find((s) => s.name === "elevated-blood-pressure")!;
    expect(bp.displayBand).toBe("NORMAL");
    expect(bp.index).toBe(100);
  });

  it("excludes inconclusive signals from the composite entirely", () => {
    const signals: ScorableSignal[] = [
      { name: "fatigue", label: "Fatigue", score: 0.1, level: "none" },
      { name: "stress", label: "Stress", score: 0.5, level: "inconclusive" },
    ];
    const result = computeSleepScore(signals)!;
    const stress = result.signals.find((s) => s.name === "stress")!;
    expect(stress.displayBand).toBe("INCONCLUSIVE");
    expect(stress.index).toBeNull();
    expect(result.score).toBe(100);
  });

  it("returns a null score, not a fabricated one, when every present sleep-relevant sign is inconclusive", () => {
    const signals: ScorableSignal[] = [{ name: "fatigue", label: "Fatigue", score: 0.5, level: "inconclusive" }];
    const result = computeSleepScore(signals)!;
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.bandLabel).toBeNull();
  });

  it("counts repeated signs once", () => {
    const fatigue = { name: "fatigue", label: "Fatigue", score: 0.1, level: "none" };
    const stress = { name: "stress", label: "Stress", score: 0.1, level: "none" };
    const once = computeSleepScore([fatigue, stress])!;
    expect(computeSleepScore([fatigue, fatigue, stress])?.score).toBe(once.score);
    expect(once.coverageKey).toBe("fatigue,stress");
    expect(once.version).toBe("serasona-sleep-1");
  });

  it("fatigue alone scores a perfect, fully-weighted 100 when normal", () => {
    const result = computeSleepScore([{ name: "fatigue", label: "Fatigue", score: 0.05, level: "none" }])!;
    expect(result.score).toBe(100);
    expect(result.bandLabel).toBe("Clear");
  });
});

describe("sleep score reference integrity", () => {
  it("SLEEP_SCORE_REFERENCES entries all carry a title and a url", () => {
    for (const [id, ref] of Object.entries(SLEEP_SCORE_REFERENCES)) {
      expect(ref.title.length, id).toBeGreaterThan(0);
      expect(ref.url.startsWith("https://"), id).toBe(true);
    }
  });

  it("sleepReferenceFor resolves both the sleep-specific table and the shared score-evidence table", () => {
    expect(sleepReferenceFor("sleepDebtNextDayAffect").url).toContain("34323993");
    // "fatigue" lives in the main score-evidence.ts table, not this one.
    expect(sleepReferenceFor("fatigue" as never)).toBeDefined();
  });
});
