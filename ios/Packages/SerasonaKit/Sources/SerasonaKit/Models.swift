import Foundation

/// The eight v2 models the Amplifier API serves, mirrored from
/// gcp-functions/analyze-audio/index.js (`ALLOWED_MODEL_NAMES`). A client value
/// outside this set is meaningless to the server, which falls back to `.pulse`.
public enum SerasonaModel: String, Codable, CaseIterable, Sendable {
    case pulse, clarity, haven, tide, aria, breath, harbor, apex
}

public struct ExtendedMetric: Codable, Sendable, Equatable {
    public let metricID: String
    public let label: String
    public let scoreMean: Double
    public let scoreStd: Double
    public let lowAnchor: String
    public let highAnchor: String

    enum CodingKeys: String, CodingKey {
        case metricID = "metric_id"
        case label
        case scoreMean = "score_mean"
        case scoreStd = "score_std"
        case lowAnchor = "low_anchor"
        case highAnchor = "high_anchor"
    }
}

public struct SignalReading: Codable, Sendable, Equatable {
    public let name: String
    public let label: String
    public let score: Double
    public let level: String?
    public let flagged: Bool

    public init(name: String, label: String, score: Double, level: String?, flagged: Bool) {
        self.name = name
        self.label = label
        self.score = score
        self.level = level
        self.flagged = flagged
    }
}

public struct AudioQuality: Codable, Sendable, Equatable {
    public let voicePercentage: Double?
    public let audioClarity: Double?
    public let issues: [String]?

    enum CodingKeys: String, CodingKey {
        case voicePercentage = "voice_percentage"
        case audioClarity = "audio_clarity"
        case issues
    }
}

public struct JobSummaryDescription: Codable, Sendable, Equatable {
    public let summary: String?
}

public struct JobSummary: Codable, Sendable, Equatable {
    public let overallLevel: String?
    public let recommendedAction: String?
    public let description: JobSummaryDescription?

    enum CodingKeys: String, CodingKey {
        case overallLevel = "overall_level"
        case recommendedAction = "recommended_action"
        case description
    }
}

public struct JobResultPayload: Codable, Sendable, Equatable {
    public let summary: JobSummary?
    public let signals: [SignalReading]?
    public let extendedMetrics: [ExtendedMetric]?
    public let audioQuality: AudioQuality?

    enum CodingKeys: String, CodingKey {
        case summary
        case signals
        case extendedMetrics = "extended_metrics"
        case audioQuality = "audio_quality"
    }
}

/// The job object returned by `POST /analyzeAudio`, identical in shape to the
/// one the web app receives (see src/lib/voice-checkin-client.ts `VoiceJob`).
public struct VoiceJob: Codable, Sendable, Equatable {
    public let jobID: String?
    public let audioSampleRate: Int?
    public let audioDurationSeconds: Double?
    public let status: String?
    public let result: JobResultPayload?

    enum CodingKeys: String, CodingKey {
        case jobID = "job_id"
        case audioSampleRate = "audio_sample_rate"
        case audioDurationSeconds = "audio_duration_seconds"
        case status
        case result
    }
}

/// The seven headline metrics the app surfaces first, ported from
/// `SERASONA_METRICS` in voice-checkin-client.ts. Two of the thirteen extended
/// metrics run good->bad the opposite way; `higherIsBetter` records which.
public struct SerasonaMetricSpec: Sendable {
    public let key: String
    public let label: String
    public let metricID: String
    public let higherIsBetter: Bool
}

public enum SerasonaMetrics {
    public static let headline: [SerasonaMetricSpec] = [
        .init(key: "stress", label: "Stress", metricID: "tension", higherIsBetter: false),
        .init(key: "mood", label: "Mood", metricID: "vad-valence", higherIsBetter: true),
        .init(key: "energy", label: "Energy", metricID: "energy-level", higherIsBetter: false),
        .init(key: "confidence", label: "Confidence", metricID: "vad-dominance", higherIsBetter: true),
        .init(key: "mentalFatigue", label: "Mental fatigue", metricID: "fatigue", higherIsBetter: false),
        .init(key: "alertness", label: "Alertness", metricID: "sleep-disturbance", higherIsBetter: false),
        .init(key: "focus", label: "Focus", metricID: "concentration", higherIsBetter: false),
    ]

    public struct Resolved: Sendable, Identifiable {
        public var id: String { key }
        public let key: String
        public let label: String
        public let score: Int?
        public let band: Band?
        public let confidence: Double?
    }

    public enum Band: String, Sendable {
        case clear = "Clear"
        case watch = "Watch"
        case strained = "Strained"
    }

    public static func band(for score: Int) -> Band {
        if score >= 67 { return .clear }
        if score >= 34 { return .watch }
        return .strained
    }

    /// Ports `toSevenMetrics` — reads a 0-100 "higher is better" score out of
    /// each extended metric's `score_mean`, flipping the two that run backwards.
    public static func resolve(from metrics: [ExtendedMetric]) -> [Resolved] {
        let byID = Dictionary(uniqueKeysWithValues: metrics.map { ($0.metricID, $0) })
        return headline.map { spec in
            guard let metric = byID[spec.metricID] else {
                return Resolved(key: spec.key, label: spec.label, score: nil, band: nil, confidence: nil)
            }
            let good = spec.higherIsBetter ? metric.scoreMean : 1 - metric.scoreMean
            let score = Int((good * 100).rounded())
            return Resolved(key: spec.key, label: spec.label, score: score, band: band(for: score), confidence: metric.scoreStd)
        }
    }
}

// MARK: - Voice history (gcp-functions/voice-history)

public struct StoredSummary: Codable, Sendable, Equatable {
    public let overallLevel: String?
    public let recommendedAction: String?
    public let flaggedCount: Int?
    public let totalSignals: Int?

    enum CodingKeys: String, CodingKey {
        case overallLevel, recommendedAction, flaggedCount, totalSignals
    }
}

public struct StoredSession: Codable, Sendable, Equatable, Identifiable {
    public var id: String { sessionID }
    public let sessionID: String
    public let capturedAt: Double
    public let source: String?
    public let status: String?
    public let model: String?
    public let pathway: String?
    public let signals: [SignalReading]
    public let summary: StoredSummary?

    enum CodingKeys: String, CodingKey {
        case sessionID = "sessionId"
        case capturedAt, source, status, model, pathway, signals, summary
    }
}

struct HistoryResponse: Codable {
    let sessions: [StoredSession]
}

public struct SessionToSave: Encodable {
    public let jobID: String?
    public let source: String
    public let model: String?
    public let capturedAt: Double
    public let signals: [SignalReading]
    public let summary: StoredSummary?

    enum CodingKeys: String, CodingKey {
        case jobID = "jobId"
        case source, model, capturedAt, signals, summary
    }

    public init(jobID: String?, model: String?, signals: [SignalReading], summary: StoredSummary?, capturedAt: Date = Date()) {
        self.jobID = jobID
        self.source = "ios"
        self.model = model
        self.capturedAt = capturedAt.timeIntervalSince1970 * 1000
        self.signals = signals
        self.summary = summary
    }
}
