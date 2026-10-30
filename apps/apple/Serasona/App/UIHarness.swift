import SwiftUI

/// Renders a single screen with synthetic data, without signing in.
///
/// Launch with `-serasona.uiHarness capture` or `-serasona.uiHarness result`.
/// Debug builds only: it is compiled out of Release entirely, so there is no
/// path around the sign-in gate in anything that ships.
#if DEBUG
enum UIHarness {
    static var requested: String? {
        UserDefaults.standard.string(forKey: "serasona.uiHarness")
    }

    /// A readable check-in across all three groups, with one elevated sign
    /// so the flagged count, the band colors and the scale all have
    /// something real to render.
    static func sampleCheckIn(daysAgo: Int = 0, elevated: Bool = true) -> CheckIn {
        func signal(_ name: String, _ label: String, _ level: String, _ score: Double) -> V2Signal {
            V2Signal(
                name: name,
                label: label,
                score: score,
                level: level,
                flagged: ["moderate", "elevated"].contains(level),
                recommendedAction: nil,
                description: nil
            )
        }

        let signals = [
            signal("stress", "Stress", elevated ? "moderate" : "low", 0.52),
            signal("anxiety", "Anxiety", "low", 0.31),
            signal("mood-disruption", "Mood Disruption", "none", 0.12),
            signal("fatigue", "Fatigue", elevated ? "elevated" : "consider", 0.78),
            signal("cardiovascular-strain", "Cardiovascular Strain", "none", 0.19),
            signal("dehydration", "Dehydration", "consider", 0.44),
            signal("cognitive-load", "Cognitive Load", "low", 0.28),
            signal("attention-dysregulation", "Attention Dysregulation", "none", 0.15),
        ]

        let bands = signals.map { SignalBand.band(name: $0.name, level: $0.level) }
        return CheckIn(
            id: "harness-\(daysAgo)",
            capturedAt: Date().addingTimeInterval(-Double(daysAgo) * 86_400),
            model: "pulse",
            signals: signals,
            overallLevel: elevated ? "moderate" : "low",
            flaggedCount: bands.filter(\.isFlagged).count,
            totalSignals: signals.count
        )
    }

    static var sampleHistory: [CheckIn] {
        [
            sampleCheckIn(daysAgo: 9, elevated: true),
            sampleCheckIn(daysAgo: 6, elevated: false),
            sampleCheckIn(daysAgo: 3, elevated: true),
        ]
    }
}

struct UIHarnessView: View {
    let screen: String

    var body: some View {
        switch screen {
        case "result":
            DashboardResultView(
                checkIn: UIHarness.sampleCheckIn(),
                onRecordAgain: {},
                injectedHistory: UIHarness.sampleHistory
            )
        case "settings":
            MainTabView(initialSelection: .settings, injectedDashboardHistory: [])
        case "processing":
            ProcessingView()
        case "single-result":
            MainTabView(injectedDashboardHistory: [UIHarness.sampleCheckIn()])
        case "empty-dashboard":
            MainTabView(injectedDashboardHistory: [])
        case "tabs":
            MainTabView()
        case "delete":
            DeleteAccountView(onDismiss: {})
        default:
            CaptureFlowView()
        }
    }
}
#endif
