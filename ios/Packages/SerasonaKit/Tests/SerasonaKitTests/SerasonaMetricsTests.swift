import XCTest
@testable import SerasonaKit

final class SerasonaMetricsTests: XCTestCase {
    func testHigherIsBetterMetricPassesThroughDirectly() {
        let metrics = [ExtendedMetric(metricID: "vad-valence", label: "Valence", scoreMean: 0.8, scoreStd: 0.05, lowAnchor: "low", highAnchor: "high")]
        let resolved = SerasonaMetrics.resolve(from: metrics)
        let mood = resolved.first { $0.key == "mood" }
        XCTAssertEqual(mood?.score, 80)
        XCTAssertEqual(mood?.band, .clear)
    }

    func testLowerIsBetterMetricIsFlipped() {
        // tension (stress) is "lower is better": a raw mean of 0.8 is a bad
        // reading and must come out as a LOW good-score, not 80.
        let metrics = [ExtendedMetric(metricID: "tension", label: "Tension", scoreMean: 0.8, scoreStd: 0.05, lowAnchor: "low", highAnchor: "high")]
        let resolved = SerasonaMetrics.resolve(from: metrics)
        let stress = resolved.first { $0.key == "stress" }
        XCTAssertEqual(stress?.score, 20)
        XCTAssertEqual(stress?.band, .strained)
    }

    func testMissingMetricResolvesToNilNotZero() {
        let resolved = SerasonaMetrics.resolve(from: [])
        XCTAssertEqual(resolved.count, SerasonaMetrics.headline.count)
        XCTAssertTrue(resolved.allSatisfy { $0.score == nil && $0.band == nil })
    }

    func testBandThresholds() {
        XCTAssertEqual(SerasonaMetrics.band(for: 100), .clear)
        XCTAssertEqual(SerasonaMetrics.band(for: 67), .clear)
        XCTAssertEqual(SerasonaMetrics.band(for: 66), .watch)
        XCTAssertEqual(SerasonaMetrics.band(for: 34), .watch)
        XCTAssertEqual(SerasonaMetrics.band(for: 33), .strained)
        XCTAssertEqual(SerasonaMetrics.band(for: 0), .strained)
    }
}
