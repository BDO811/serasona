import Foundation

/// History arithmetic for the results dashboard, ported from
/// `daily-scores.ts` and `dashboard-data.ts`.

/// One of the three slots in the score banner.
struct DashboardMeasurement: Identifiable {
    let label: String
    let checkIn: CheckIn?
    let score: Int?
    let bandLabel: String?

    var id: String { label }
    var capturedAt: Date? { checkIn?.capturedAt }
}

enum CheckInHistoryMath {

    private static let slotLabels = ["Latest", "Previous", "Earlier"]

    /// The three most recently captured scored check-ins, newest first.
    ///
    /// Ranked by recency alone, never bucketed by calendar day, so three
    /// readings taken in one afternoon fill all three slots and a day with
    /// nothing recorded is simply skipped. Never averaged.
    static func lastThree(_ checkIns: [CheckIn], now: Date = Date()) -> [DashboardMeasurement] {
        let scored = checkIns
            .filter { $0.capturedAt <= now }
            .compactMap { checkIn -> (CheckIn, Int)? in
                guard let score = SerasonaScore.compute(signals: checkIn.signals)?.score else { return nil }
                return (checkIn, score)
            }
            .sorted { $0.0.capturedAt > $1.0.capturedAt }
            .prefix(3)

        return slotLabels.enumerated().map { offset, label in
            guard offset < scored.count else {
                return DashboardMeasurement(label: label, checkIn: nil, score: nil, bandLabel: nil)
            }
            let (checkIn, score) = Array(scored)[offset]
            return DashboardMeasurement(
                label: label,
                checkIn: checkIn,
                score: score,
                bandLabel: ScoreBandLabel.of(score)
            )
        }
    }

    /// Everything captured inside the window, oldest first.
    static func within(_ checkIns: [CheckIn], days: Int, now: Date = Date()) -> [CheckIn] {
        let cutoff = now.addingTimeInterval(-Double(days) * 86_400)
        return checkIns
            .filter { $0.capturedAt >= cutoff && $0.capturedAt <= now }
            .sorted { $0.capturedAt < $1.capturedAt }
    }

    /// Same model and same returned sign coverage only.
    ///
    /// A trend across two different panels is not a trend, it is two
    /// different measurements plotted on one line. A change in coverage
    /// starts a separate comparison rather than extending this one.
    static func cohortKey(_ checkIn: CheckIn) -> String {
        let result = SerasonaScore.compute(signals: checkIn.signals)
        return [checkIn.model, result?.coverageKey ?? "", result?.version ?? ""].joined(separator: "|")
    }

    static func comparable(_ checkIns: [CheckIn], to reference: CheckIn?) -> [CheckIn] {
        guard let reference else { return [] }
        let key = cohortKey(reference)
        return checkIns.filter { cohortKey($0) == key }
    }

    /// Scored value of one check-in, or nil when nothing in it was readable.
    static func score(_ checkIn: CheckIn) -> Int? {
        SerasonaScore.compute(signals: checkIn.signals)?.score
    }

    /// One group's index for one check-in.
    static func index(_ checkIn: CheckIn, group: ScoreGroup) -> Int? {
        SerasonaScore.compute(signals: checkIn.signals)?.groups.first { $0.group == group }?.index
    }
}
