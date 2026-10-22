import XCTest
@testable import SerasonaKit

final class SignalBandingTests: XCTestCase {
    func testPlainLevelsMapStraightThrough() {
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "tension", level: "none"), .normal)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "tension", level: "low"), .normal)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "tension", level: "consider"), .low)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "tension", level: "moderate"), .moderate)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "tension", level: "elevated"), .elevated)
    }

    func testUnrecognisedLevelIsInconclusiveNeverNormal() {
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "tension", level: "some-future-level"), .inconclusive)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "tension", level: nil), .inconclusive)
    }

    func testHeadImpactOnlyFlagsAtElevated() {
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "head-impact", level: "consider"), .normal)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "head-impact", level: "moderate"), .normal)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "head-impact", level: "elevated"), .elevated)
    }

    func testElevatedBloodPressureSameOverrideAsHeadImpact() {
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "elevated-blood-pressure", level: "moderate"), .normal)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "elevated-blood-pressure", level: "elevated"), .elevated)
    }

    func testPercentileBucketedSignalsIgnoreLevelAndUseScore() {
        // API says "elevated" but the score is nowhere near the top 5% — the
        // percentile override should still win for these two signal names.
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "cardiovascular-strain", level: "elevated", score: 0.5), .normal)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "cardiovascular-strain", level: "none", score: 0.92), .moderate)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "cognitive-load", level: "none", score: 0.97), .elevated)
    }

    func testInconclusiveNeverRewrittenByAnyOverride() {
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "head-impact", level: nil), .inconclusive)
        XCTAssertEqual(SignalBanding.band(forSignalNamed: "cardiovascular-strain", level: nil, score: 0.99), .inconclusive)
    }

    func testIsFlaggedMatchesEveryBandButNormalAndInconclusive() {
        XCTAssertFalse(SignalBanding.isFlagged(.normal))
        XCTAssertFalse(SignalBanding.isFlagged(.inconclusive))
        XCTAssertTrue(SignalBanding.isFlagged(.low))
        XCTAssertTrue(SignalBanding.isFlagged(.moderate))
        XCTAssertTrue(SignalBanding.isFlagged(.elevated))
    }

    func testRecommendedActionLabelsAndFallback() {
        XCTAssertEqual(RecommendedAction(raw: "escalate").label, "Prompt clinical escalation")
        XCTAssertEqual(RecommendedAction(raw: "not-a-real-action").label, "Collect a new sample")
        XCTAssertEqual(RecommendedAction(raw: nil).label, "Collect a new sample")
    }
}
