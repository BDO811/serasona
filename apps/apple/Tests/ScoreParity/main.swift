import Foundation

func signal(_ name: String, _ level: String = "none", _ score: Double = 0.2) -> V2Signal {
    V2Signal(name: name, label: name, score: score, level: level, flagged: false,
             recommendedAction: nil, description: nil)
}
func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else { fatalError(message) }
}
let pulse = [signal("fatigue", "moderate"), signal("stress"), signal("anxiety"),
             signal("mood-disruption"), signal("dehydration"), signal("elevated-blood-pressure")]
let reading = CheckIn(id: "pulse-test", capturedAt: Date(), model: "pulse", signals: pulse,
                      overallLevel: "moderate", flaggedCount: 1, totalSignals: pulse.count)
expect(ClarityScore.compute(signals: pulse)?.score == 71, "Pulse must match the website's Clarity score of 71")
expect(CheckInHistoryMath.index(reading, group: .clarity) == 71, "Cards and saved-history matrix must use dedicated Clarity")
expect(ClarityScore.compute(signals: [signal("fatigue")])?.score == 100, "Readable fatigue alone must populate Clarity")
expect(ClarityScore.compute(signals: [signal("fatigue", "elevated")])?.score == 8, "Elevated fatigue uses the same band index as web")
expect(ClarityScore.compute(signals: [signal("stress")]) == nil, "Stress alone must not invent mental readiness")
expect(ClarityScore.compute(signals: [signal("dehydration")]) == nil, "Unrelated signs must not populate Clarity")
expect(ClarityScore.compute(signals: [signal("fatigue", "inconclusive")]) == nil, "Unreadable fatigue stays unscored")
expect(ClarityScore.compute(signals: [signal("fatigue", "none", .nan)]) == nil, "Invalid scores stay unscored")
expect(ClarityScore.compute(signals: [signal("fatigue", "none", 2)]) == nil, "Out-of-range values stay unscored")
let duplicate = signal("cognitive-impairment", "moderate")
expect(ClarityScore.compute(signals: [duplicate, duplicate])?.score == 38, "Duplicate signs count only once")
expect(CheckInHistoryMath.cohortKey(reading).contains(ClarityScore.version), "Trend cohorts must include the Clarity formula version")
print("11 native Clarity parity checks passed.")
