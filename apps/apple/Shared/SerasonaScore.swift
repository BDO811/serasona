import Foundation

/// The Serasona Score: one composite read across whatever signs the active
/// model(s) actually returned for a check-in. Ported 1:1 from
/// `Serasona_Site/src/lib/serasona-score.ts` — see that file for the full
/// reasoning. Short version: the product's marketing copy names seven
/// signals (stress, mood, energy, confidence, mental fatigue, alertness,
/// focus) that don't exist in the v2 API. Each real model returns a
/// different, fixed bundle drawn from twenty-one clinical signs instead
/// (`SerasonaModel` / the web's `models.ts`). This is the real mapping:
/// every sign is bucketed into Stress, Wellness or Clarity and weighted, so
/// the composite reflects only what was actually measured.
///
/// Scored from `SignalBand.band(name:level:)`, not raw score, for the same
/// reason the web port gives: score-to-level calibration is distribution-
/// based and per-model, so raw scores aren't comparable across signs.

enum ScoreGroup: String, CaseIterable, Identifiable {
    case stress, wellness, clarity
    var id: String { rawValue }

    var label: String {
        switch self {
        case .stress: return "Stress"
        case .wellness: return "Wellness"
        case .clarity: return "Clarity"
        }
    }

    var description: String {
        switch self {
        case .stress: return "Tension read from pitch, pause length and vocal strain."
        case .wellness: return "Fatigue, cardiovascular and general-health signs, read together."
        case .clarity: return "Mental readiness from fatigue, cognitive signs, stress and mood."
        }
    }
}

private struct SignDefinition {
    let group: ScoreGroup
    let weight: Double
}

private let signDefinitions: [String: SignDefinition] = [
    // Stress — mental and emotional strain.
    "stress": SignDefinition(group: .stress, weight: 20),
    "anxiety": SignDefinition(group: .stress, weight: 16),
    "mood-disruption": SignDefinition(group: .stress, weight: 10),
    "hypervigilance": SignDefinition(group: .stress, weight: 10),
    "emotional-destabilization": SignDefinition(group: .stress, weight: 10),

    // Wellness — physiological and general-health signs.
    "fatigue": SignDefinition(group: .wellness, weight: 10),
    "elevated-blood-pressure": SignDefinition(group: .wellness, weight: 7),
    "cardiovascular-strain": SignDefinition(group: .wellness, weight: 7),
    "dehydration": SignDefinition(group: .wellness, weight: 6),
    "airway-obstruction-pattern": SignDefinition(group: .wellness, weight: 6),
    "alcohol-use-pattern": SignDefinition(group: .wellness, weight: 6),
    "substance-use-pattern": SignDefinition(group: .wellness, weight: 6),
    "metabolic-load": SignDefinition(group: .wellness, weight: 5),
    "iron-deficiency": SignDefinition(group: .wellness, weight: 4),
    "elevated-androgens": SignDefinition(group: .wellness, weight: 4),
    "allergy": SignDefinition(group: .wellness, weight: 4),
    "dry-mouth": SignDefinition(group: .wellness, weight: 3),

    // Clarity — cognitive signs.
    "cognitive-impairment": SignDefinition(group: .clarity, weight: 14),
    "cognitive-load": SignDefinition(group: .clarity, weight: 9),
    "head-impact": SignDefinition(group: .clarity, weight: 9),
    "attention-dysregulation": SignDefinition(group: .clarity, weight: 9),
]

/// A sign the registry doesn't recognise yet. Stays visible but unscored —
/// an earlier version gave it a fallback weight in Wellness, which quietly
/// invented a wellness reading for a sign nobody had actually evaluated.
private let fallbackDefinition = SignDefinition(group: .wellness, weight: 0)

/// serasona-score.ts's version tag, carried alongside every result so a
/// caller can tell which weighting scheme produced a stored score.
let serasonaScoreVersion = "serasona-1"

/// Band to composite index. Ordinal, not linear in raw score — see the
/// module doc. `.inconclusive` has no entry; it's filtered out before use.
private let bandIndex: [DisplayBand: Double] = [
    .normal: 100, .low: 68, .moderate: 38, .elevated: 8,
]

struct ScoredSignal: Identifiable {
    var id: String { name }
    let name: String
    let label: String
    let group: ScoreGroup
    let weight: Double
    let displayBand: DisplayBand
    /// 0-100, nil when the reading was inconclusive.
    let index: Double?
}

struct GroupScore: Identifiable {
    var id: String { group.rawValue }
    let group: ScoreGroup
    /// Weighted average index across this group's scoreable signals, 0-100.
    let index: Int?
    let signals: [ScoredSignal]
}

struct SerasonaScoreResult {
    /// Nil when every present signal was inconclusive.
    let score: Int?
    let band: OverallState?
    /// Only the groups with at least one scoreable signal.
    let groups: [GroupScore]
    let signals: [ScoredSignal]
    let version: String
    /// Sorted, comma-joined names of the signals that actually entered the
    /// composite — lets a caller tell "stress only" from "stress + anxiety"
    /// apart before comparing two scores.
    let coverageKey: String
}

private func weightedAverage(_ items: [(index: Double, weight: Double)]) -> Int? {
    guard !items.isEmpty else { return nil }
    let totalWeight = items.reduce(0) { $0 + $1.weight }
    let mean = totalWeight == 0
        ? items.reduce(0) { $0 + $1.index } / Double(items.count)
        : items.reduce(0) { $0 + $1.index * $1.weight } / totalWeight
    return Int(mean.rounded())
}

enum SerasonaScore {
    static func compute(signals: [V2Signal]) -> SerasonaScoreResult? {
        guard !signals.isEmpty else { return nil }

        // Repeated signs (the same name sent twice in one result) count once,
        // keeping the last occurrence — same as the web port's
        // `new Map(signals.map(s => [s.name, s])).values()`.
        var byName: [String: V2Signal] = [:]
        var order: [String] = []
        for s in signals {
            if byName[s.name] == nil { order.append(s.name) }
            byName[s.name] = s
        }
        let unique = order.compactMap { byName[$0] }

        let scored: [ScoredSignal] = unique.map { s in
            let key = s.name.lowercased()
            let def = signDefinitions[key] ?? fallbackDefinition
            let band = SignalBand.band(name: s.name, level: s.level)
            let validScore = s.score.isFinite && s.score >= 0 && s.score <= 1
            let hasDefinition = signDefinitions[key] != nil
            let index: Double? = (band == .inconclusive || !hasDefinition || !validScore) ? nil : bandIndex[band]
            return ScoredSignal(
                name: s.name,
                label: s.displayName.isEmpty ? s.name : s.displayName,
                group: def.group,
                weight: def.weight,
                displayBand: band,
                index: index
            )
        }

        func scoreable(_ items: [ScoredSignal]) -> [ScoredSignal] {
            items.filter { $0.index != nil }
        }
        func pairs(_ items: [ScoredSignal]) -> [(index: Double, weight: Double)] {
            items.compactMap { s in s.index.map { (index: $0, weight: s.weight) } }
        }

        let scoreableSignals = scoreable(scored)
        let score = weightedAverage(pairs(scoreableSignals))
        let band: OverallState? = score.map { s in
            if s >= 67 { return .clear }
            if s >= 34 { return .watch }
            return .strained
        }

        let groups: [GroupScore] = ScoreGroup.allCases.compactMap { group in
            let members = scored.filter { $0.group == group }
            let memberScoreable = pairs(scoreable(members))
            guard !memberScoreable.isEmpty else { return nil }
            return GroupScore(group: group, index: weightedAverage(memberScoreable), signals: members)
        }

        let coverageKey = scoreableSignals.map(\.name).sorted().joined(separator: ",")
        return SerasonaScoreResult(
            score: score, band: band, groups: groups, signals: scored,
            version: serasonaScoreVersion, coverageKey: coverageKey
        )
    }
}
