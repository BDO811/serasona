import SwiftUI

/// Ported 1:1 from `Serasona_App/src/lib/signal-band.ts` so the native result
/// screen bands, labels and colors match the web app exactly. See that file
/// for the full reasoning behind each rule — comments here are trimmed to
/// what a reader needs to trust the port, not repeat the original essay.

enum SignalLevel: String {
    case none, low, consider, moderate, elevated, inconclusive

    /// Normalizes a raw API level string. Unrecognized or missing reads
    /// `inconclusive` rather than `none` — see the TS source for why.
    static func of(_ raw: String?) -> SignalLevel {
        SignalLevel(rawValue: (raw ?? "").lowercased()) ?? .inconclusive
    }
}

enum DisplayBand: String {
    case normal = "NORMAL"
    case low = "LOW"
    case moderate = "MODERATE"
    case elevated = "ELEVATED"
    case inconclusive = "INCONCLUSIVE"

    static let order: [DisplayBand] = [.normal, .low, .moderate, .elevated]

    private static let levelToBand: [SignalLevel: DisplayBand] = [
        .none: .normal, .low: .normal, .consider: .low, .moderate: .moderate,
        .elevated: .elevated, .inconclusive: .inconclusive,
    ]

    static func of(level: SignalLevel) -> DisplayBand { levelToBand[level] ?? .inconclusive }

    static func ofLevel(_ raw: String?) -> DisplayBand { of(level: .of(raw)) }

    var isFlagged: Bool { self == .low || self == .moderate || self == .elevated }
}

/// Signs that only ever display as flagged at the top of the scale — a
/// clinical finding rather than a description of how a voice sounded.
private let flagOnlyWhenElevated: Set<String> = ["head-impact", "elevated-blood-pressure"]

/// Signs where a faint (LOW) indicator reads as still-good and is colored
/// like the NORMAL band rather than the caution hue.
private let greenThroughLow: Set<String> = ["fatigue", "stress", "anxiety"]

/// Signs whose NORMAL band reads "NONE" rather than "NORMAL" ("no impact
/// detected" vs. the self-contradicting "a normal amount of head trauma").
private let noneInsteadOfNormal: Set<String> = ["head-impact", "fatigue", "dehydration", "mood-disruption", "anxiety"]

private let signLabelOverrides: [String: String] = [
    "elevated-blood-pressure": "Blood Pressure",
]

enum SignalBand {
    /// The band to display for a sign, applying the per-sign override. Use
    /// this everywhere a band reaches a screen, a count, or a grade.
    static func band(name: String?, level: String?) -> DisplayBand {
        let band = DisplayBand.ofLevel(level)
        if band == .inconclusive { return band }
        let key = (name ?? "").lowercased()
        if flagOnlyWhenElevated.contains(key) {
            return band == .elevated ? .elevated : .normal
        }
        return band
    }

    static func label(name: String?, band: DisplayBand) -> String {
        if band == .normal, noneInsteadOfNormal.contains((name ?? "").lowercased()) {
            return "NONE"
        }
        return band.rawValue
    }

    static func displayName(name: String?, apiLabel: String?) -> String {
        signLabelOverrides[(name ?? "").lowercased()] ?? apiLabel ?? ""
    }

    static func color(name: String?, band: DisplayBand) -> Color {
        if band == .low, greenThroughLow.contains((name ?? "").lowercased()) {
            return rawColor(.normal)
        }
        return rawColor(band)
    }

    private static func rawColor(_ band: DisplayBand) -> Color {
        switch band {
        case .normal: return SerasonaColor.bandNormal
        case .low: return SerasonaColor.bandLow
        case .moderate: return SerasonaColor.bandModerate
        case .elevated: return SerasonaColor.bandElevated
        case .inconclusive: return SerasonaColor.bandInconclusive
        }
    }

    static func softBackground(_ band: DisplayBand) -> Color {
        switch band {
        case .normal: return SerasonaColor.stateClearSoft
        case .low: return SerasonaColor.stateWatchSoft
        case .moderate: return SerasonaColor.stateWatchSoft
        case .elevated: return SerasonaColor.stateStrainedSoft
        case .inconclusive: return SerasonaColor.surfaceSunken
        }
    }
}

/// The overall-level merge Serasona shows as a single word on the result
/// screen's hero state: Clear / Watch / Strained. This is Serasona's own
/// three-word simplification of the four-band scale above — Watch covers
/// both LOW and MODERATE so the top-line state stays a single glance.
enum OverallState: String {
    case clear = "Clear"
    case watch = "Watch"
    case strained = "Strained"
    case inconclusive = "Inconclusive"

    static func from(worstBand: DisplayBand) -> OverallState {
        switch worstBand {
        case .normal: return .clear
        case .low, .moderate: return .watch
        case .elevated: return .strained
        case .inconclusive: return .inconclusive
        }
    }

    var color: Color {
        switch self {
        case .clear: return SerasonaColor.stateClear
        case .watch: return SerasonaColor.stateWatch
        case .strained: return SerasonaColor.stateStrained
        case .inconclusive: return SerasonaColor.bandInconclusive
        }
    }

    var softBackground: Color {
        switch self {
        case .clear: return SerasonaColor.stateClearSoft
        case .watch: return SerasonaColor.stateWatchSoft
        case .strained: return SerasonaColor.stateStrainedSoft
        case .inconclusive: return SerasonaColor.surfaceSunken
        }
    }
}
