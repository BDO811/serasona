import SwiftUI

/// The four-rung assessment scale, ported from `RUNG_SCALE` in
/// `Serasona_Site/src/lib/result-headline.ts`.
///
/// Weakest first, so the scale always reads left to right from
/// needs-attention to best, the same direction as every band scale in the
/// product.
///
/// One deliberate difference from the web. The web colors `good` green and
/// `clean` gold. This app's palette carries no green at all — its own
/// `bandNormal` already resolves to tide rather than the web's `#7CC49A` —
/// so the two upper rungs are tide and hydration-blue here. Four distinct
/// hues, none of them green, and the rung is always named rather than
/// signalled by color alone.
enum AssessmentRung: String, CaseIterable, Identifiable {
    case low
    case medium
    case strong
    case optimal

    var id: String { rawValue }

    var label: String {
        switch self {
        case .low: return "LOW"
        case .medium: return "MEDIUM"
        case .strong: return "STRONG"
        case .optimal: return "OPTIMAL"
        }
    }

    /// `RUNG_RECOMMENDATION` — the phrase shown beside the scale. Keyed to
    /// the rung so the lit word and the phrase are one computation and can
    /// never disagree.
    var recommendation: String {
        switch self {
        case .low: return "Consider Evaluation"
        case .medium: return "Needs Optimization"
        case .strong: return "You are Healthy"
        case .optimal: return "You are at Peak Performance"
        }
    }

    var color: Color {
        switch self {
        case .low: return SerasonaColor.stateStrained
        case .medium: return SerasonaColor.stateWatch
        case .strong: return SerasonaColor.tide
        case .optimal: return SerasonaColor.metricHydration
        }
    }

    /// `levelForScore` — grades one 0-100 index on the same four rungs the
    /// assessment scale uses, so every colored box on the results screen
    /// grades on one scale rather than a coarser one that could only ever
    /// show two of its four colors.
    static func of(_ score: Int) -> AssessmentRung {
        if score >= 90 { return .optimal }
        if score >= 67 { return .strong }
        if score >= 34 { return .medium }
        return .low
    }
}
