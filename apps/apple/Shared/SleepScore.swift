import Foundation

/// The Sleep Score, ported 1:1 from `Serasona_Site/src/lib/sleep-score.ts`.
///
/// A separate composite from the Serasona Score, over the subset of signs
/// that actually carry sleep, with its own weights. It is not a slice of
/// the main score: a rested night can show through a stressful day, and
/// reading it off the whole panel would bury that.
///
/// Scored off the display band rather than the raw score, for the same
/// reason the main composite is: score-to-level calibration is per-model
/// and distribution-based, so raw scores aren't comparable across signs.
enum SleepScore {

    /// Every key here is also a sign in `signDefinitions` over in
    /// SerasonaScore.swift. The web enforces that with a throwing check at
    /// import time, which has no equivalent here: a rename on that side
    /// would leave this composite silently scoring nothing for that sign,
    /// so change the two together.
    static let signWeights: [String: Double] = [
        "fatigue": 24,
        "stress": 13,
        "anxiety": 8,
        "mood-disruption": 8,
        "emotional-destabilization": 6,
        "cognitive-load": 11,
        "attention-dysregulation": 9,
        "cognitive-impairment": 5,
        "cardiovascular-strain": 5,
        "elevated-blood-pressure": 4,
        "metabolic-load": 4,
    ]

    static let version = "serasona-sleep-1"

    private static let bandIndex: [DisplayBand: Double] = [
        .normal: 100, .low: 68, .moderate: 38, .elevated: 8,
    ]

    struct Result {
        /// Nil when every sleep-relevant sign present was inconclusive, or
        /// when the panel carried none of them at all.
        let score: Int?
        let bandLabel: String?
        let coverageKey: String
        let version: String
    }

    static func compute(signals: [V2Signal]) -> Result? {
        guard !signals.isEmpty else { return nil }

        // Repeated signs count once, keeping the last occurrence.
        var byName: [String: V2Signal] = [:]
        var order: [String] = []
        for signal in signals {
            if byName[signal.name] == nil { order.append(signal.name) }
            byName[signal.name] = signal
        }
        let relevant = order
            .compactMap { byName[$0] }
            .filter { signWeights[$0.name.lowercased()] != nil }
        guard !relevant.isEmpty else { return nil }

        var weighted = 0.0
        var totalWeight = 0.0
        var counted: [String] = []

        for signal in relevant {
            let band = SignalBand.band(name: signal.name, level: signal.level)
            let validScore = signal.score.isFinite && signal.score >= 0 && signal.score <= 1
            guard band != .inconclusive, validScore, let index = bandIndex[band] else { continue }
            let weight = signWeights[signal.name.lowercased()] ?? 0
            weighted += index * weight
            totalWeight += weight
            counted.append(signal.name)
        }

        guard totalWeight > 0 else {
            return Result(score: nil, bandLabel: nil, coverageKey: "", version: version)
        }

        let score = Int((weighted / totalWeight).rounded())
        return Result(
            score: score,
            bandLabel: ScoreBandLabel.of(score),
            coverageKey: counted.sorted().joined(separator: ","),
            version: version
        )
    }
}

/// `scoreBandFor` from serasona-score.ts: the three-step reading every
/// 0-100 index on the dashboard carries beside its number, so no number
/// ever appears without the word that explains it.
enum ScoreBandLabel {
    static func of(_ score: Int) -> String {
        if score >= 67 { return "Clear" }
        if score >= 34 { return "Watch" }
        return "Strained"
    }
}
