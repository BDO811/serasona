import Foundation

/// Ported from src/lib/signal-band.ts. Levels and bands come from the API's
/// own display vocabulary (docs.amplifierhealth.com/guides/interpreting-results),
/// never derived from score, with two named exceptions the web app already
/// carries (see `PERCENTILE_BUCKETED_SIGNALS` and `FLAG_ONLY_WHEN_ELEVATED`
/// below) and which have to behave identically here or a signal would show a
/// different band on phone vs. web for the same recording.
public enum SignalLevel: String, Sendable {
    case none, low, consider, moderate, elevated, inconclusive
}

public enum DisplayBand: String, Sendable {
    case normal = "NORMAL"
    case low = "LOW"
    case moderate = "MODERATE"
    case elevated = "ELEVATED"
    case inconclusive = "INCONCLUSIVE"
}

public enum SignalBanding {
    private static let levelOrder: [SignalLevel] = [.none, .low, .consider, .moderate, .elevated]

    public static func level(of raw: String?) -> SignalLevel {
        let key = (raw ?? "").lowercased()
        return SignalLevel(rawValue: key) ?? .inconclusive
    }

    public static let levelLabels: [SignalLevel: String] = [
        .none: "Within normal range",
        .low: "Faint indicator",
        .consider: "Worth considering",
        .moderate: "Notable indicator",
        .elevated: "Significant indicator",
        .inconclusive: "Analysis inconclusive",
    ]

    private static let levelToBand: [SignalLevel: DisplayBand] = [
        .none: .normal,
        .low: .normal,
        .consider: .low,
        .moderate: .moderate,
        .elevated: .elevated,
        .inconclusive: .inconclusive,
    ]

    public static func band(of level: SignalLevel) -> DisplayBand {
        levelToBand[level] ?? .inconclusive
    }

    /// Signs that only ever display as flagged at the top of the scale — a
    /// faint reading of a named clinical finding should not read as a flag.
    private static let flagOnlyWhenElevated: Set<String> = ["head-impact", "elevated-blood-pressure"]

    /// Bucketed from raw score rather than the API's level, by Amit's explicit
    /// instruction (2026-10-15): worst 10% -> MODERATE, worst 5% -> ELEVATED.
    private static let percentileBucketedSignals: Set<String> = ["cardiovascular-strain", "cognitive-load"]
    private static let percentileElevatedAt = 0.95
    private static let percentileModerateAt = 0.90

    private static func bandForPercentileBucketed(score: Double) -> DisplayBand {
        if score >= percentileElevatedAt { return .elevated }
        if score >= percentileModerateAt { return .moderate }
        return .normal
    }

    /// The band to display for a given signal, applying the same per-signal
    /// overrides the web app applies — use this everywhere a band reaches the
    /// screen, a flag count, or a score, never `band(of:)` alone.
    public static func band(forSignalNamed name: String?, level rawLevel: String?, score: Double? = nil) -> DisplayBand {
        let lvl = level(of: rawLevel)
        let computed = band(of: lvl)
        if computed == .inconclusive { return computed }
        let key = (name ?? "").lowercased()
        if percentileBucketedSignals.contains(key), let score {
            return bandForPercentileBucketed(score: score)
        }
        if flagOnlyWhenElevated.contains(key) {
            return computed == .elevated ? .elevated : .normal
        }
        return computed
    }

    public static func isFlagged(_ band: DisplayBand) -> Bool {
        band == .low || band == .moderate || band == .elevated
    }
}

public enum RecommendedAction: String, Sendable {
    case none, monitor, consider, review, escalate, inconclusive

    public init(raw: String?) {
        self = RecommendedAction(rawValue: (raw ?? "").lowercased()) ?? .inconclusive
    }

    public var label: String {
        switch self {
        case .none: return "No action warranted"
        case .monitor: return "Routine follow-up"
        case .consider: return "Clinician discretion"
        case .review: return "Clinical follow-up recommended"
        case .escalate: return "Prompt clinical escalation"
        case .inconclusive: return "Collect a new sample"
        }
    }
}
