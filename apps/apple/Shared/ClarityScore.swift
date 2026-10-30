import Foundation

/// The website's serasona-clarity-1 mental-readiness index. Separate from
/// the main composite, so fatigue is not counted twice in the Serasona Score.
enum ClarityScore {
    static let version = "serasona-clarity-1"
    static let signWeights: [String: Double] = [
        "fatigue": 30, "cognitive-impairment": 25, "cognitive-load": 20,
        "attention-dysregulation": 20, "stress": 15, "anxiety": 10,
        "mood-disruption": 10,
    ]
    private static let anchors: Set<String> = [
        "fatigue", "cognitive-impairment", "cognitive-load", "attention-dysregulation",
    ]

    struct Result {
        let score: Int
        let bandLabel: String
        let version: String
        let coverageKey: String
    }

    static func compute(signals: [V2Signal]) -> Result? {
        let readable = SerasonaScore.compute(signals: signals)?.signals.filter {
            $0.index != nil && signWeights[$0.name] != nil
        } ?? []
        // Stress and mood alone cannot substitute for a readiness anchor.
        guard readable.contains(where: { anchors.contains($0.name) }) else { return nil }
        let totalWeight = readable.reduce(0.0) { $0 + (signWeights[$1.name] ?? 0) }
        guard totalWeight > 0 else { return nil }
        let sum = readable.reduce(0.0) { $0 + ($1.index ?? 0) * (signWeights[$1.name] ?? 0) }
        let score = Int((sum / totalWeight).rounded())
        return Result(score: score, bandLabel: ScoreBandLabel.of(score), version: version,
                      coverageKey: readable.map(\.name).sorted().joined(separator: ","))
    }
}
