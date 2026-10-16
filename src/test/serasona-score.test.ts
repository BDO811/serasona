import { describe, expect, it } from "vitest";
import { computeSerasonaScore, SIGN_DEFINITIONS, type ScorableSignal } from "@/lib/serasona-score";

/** The real pulse+apex sample from PanelPreview.tsx. */
const LIVE_SIGNALS: ScorableSignal[] = [
  { name: "fatigue", label: "Fatigue", score: 0.318, level: "consider" },
  { name: "stress", label: "Stress", score: 0.284, level: "consider" },
  { name: "anxiety", label: "Anxiety", score: 0.512, level: "moderate" },
  { name: "head-impact", label: "Head Impact", score: 0.14, level: "low" },
  { name: "elevated-blood-pressure", label: "Elevated Blood Pressure", score: 0.308, level: "low" },
];

describe("computeSerasonaScore", () => {
  it("returns null for no signals", () => {
    expect(computeSerasonaScore(undefined)).toBeNull();
    expect(computeSerasonaScore([])).toBeNull();
  });

  it("scores every real sign in the catalogue, none falling through to the fallback bucket silently", () => {
    // Every sign models.ts can return must have an explicit weight, so a
    // forgotten entry doesn't quietly dilute into the fallback weight.
    const result = computeSerasonaScore(LIVE_SIGNALS);
    expect(result).not.toBeNull();
    expect(result!.signals).toHaveLength(LIVE_SIGNALS.length);
    for (const s of result!.signals) {
      expect(SIGN_DEFINITIONS[s.name]).toBeDefined();
    }
  });

  it("fatigue and stress at 'consider' band as LOW — GREEN_THROUGH_LOW only recolors the band for display, it does not change bandForSignal's return", () => {
    const result = computeSerasonaScore(LIVE_SIGNALS)!;
    const fatigue = result.signals.find((s) => s.name === "fatigue")!;
    const stress = result.signals.find((s) => s.name === "stress")!;
    expect(fatigue.displayBand).toBe("LOW");
    expect(stress.displayBand).toBe("LOW");
    expect(fatigue.index).toBe(68);
    expect(stress.index).toBe(68);
  });

  it("head-impact and elevated-blood-pressure only flag at ELEVATED, so 'low' composites as NORMAL", () => {
    const result = computeSerasonaScore(LIVE_SIGNALS)!;
    const headImpact = result.signals.find((s) => s.name === "head-impact")!;
    const bp = result.signals.find((s) => s.name === "elevated-blood-pressure")!;
    expect(headImpact.displayBand).toBe("NORMAL");
    expect(bp.displayBand).toBe("NORMAL");
  });

  it("anxiety at 'moderate' pulls the composite down, grouped under stress", () => {
    const result = computeSerasonaScore(LIVE_SIGNALS)!;
    const anxiety = result.signals.find((s) => s.name === "anxiety")!;
    expect(anxiety.displayBand).toBe("MODERATE");
    expect(anxiety.group).toBe("stress");

    const stressGroup = result.groups.find((g) => g.group === "stress")!;
    expect(stressGroup.index).not.toBeNull();
    // stress (NORMAL, 100) and anxiety (MODERATE, 38) both weigh into this
    // group, so it must land strictly between the two.
    expect(stressGroup.index!).toBeGreaterThan(38);
    expect(stressGroup.index!).toBeLessThan(100);

    // The composite overall must be dragged below a perfect 100 by anxiety,
    // even though every other present sign reads NORMAL.
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeLessThan(100);
  });

  it("excludes inconclusive signals from the composite entirely, rather than scoring them as a failure", () => {
    const signals: ScorableSignal[] = [
      { name: "stress", label: "Stress", score: 0.1, level: "none" },
      { name: "anxiety", label: "Anxiety", score: 0.5, level: "inconclusive" },
    ];
    const result = computeSerasonaScore(signals)!;
    const anxiety = result.signals.find((s) => s.name === "anxiety")!;
    expect(anxiety.displayBand).toBe("INCONCLUSIVE");
    expect(anxiety.index).toBeNull();
    // Only the one scoreable sign (stress, NORMAL) should drive the composite.
    expect(result.score).toBe(100);
  });

  it("returns a null score, not a fabricated one, when every present sign is inconclusive", () => {
    const signals: ScorableSignal[] = [
      { name: "stress", label: "Stress", score: 0.5, level: "inconclusive" },
    ];
    const result = computeSerasonaScore(signals)!;
    expect(result.score).toBeNull();
    expect(result.band).toBeNull();
    expect(result.groups).toHaveLength(0);
  });

  it("only returns groups with at least one present signal", () => {
    // LIVE_SIGNALS mixes pulse (fatigue/stress/anxiety) and apex
    // (head-impact/elevated-blood-pressure), so all three groups are present
    // here. A genuinely pulse-only reading (no head-impact) would omit
    // Clarity entirely rather than show an empty card.
    const pulseOnly = LIVE_SIGNALS.filter((s) => s.name !== "head-impact");
    const result = computeSerasonaScore(pulseOnly)!;
    const groupKeys = result.groups.map((g) => g.group);
    expect(groupKeys).toContain("stress");
    expect(groupKeys).toContain("wellness");
    expect(groupKeys).not.toContain("clarity");
  });

  it("percentile-bucketed signs (cardiovascular-strain, cognitive-load) still band correctly from score", () => {
    const signals: ScorableSignal[] = [
      { name: "cardiovascular-strain", label: "Cardiovascular Strain", score: 0.97, level: "low" },
      { name: "cognitive-load", label: "Cognitive Load", score: 0.2, level: "elevated" },
    ];
    const result = computeSerasonaScore(signals)!;
    const cv = result.signals.find((s) => s.name === "cardiovascular-strain")!;
    const cl = result.signals.find((s) => s.name === "cognitive-load")!;
    // Percentile override wins regardless of what `level` said.
    expect(cv.displayBand).toBe("ELEVATED");
    expect(cl.displayBand).toBe("NORMAL");
    expect(cv.group).toBe("wellness");
    expect(cl.group).toBe("clarity");
  });
});
