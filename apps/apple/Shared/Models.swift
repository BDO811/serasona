import Foundation

/// Mirrors `Serasona_App/src/lib/v2-api-visual-mapping.ts`'s `V2*` types —
/// the Amplifier Health v2 API's job/result shape, as proxied by the
/// `analyzeAudio` Cloud Function (which polls `/v2/jobs/{id}` server-side and
/// returns the terminal job document directly).

struct V2VocalFeature: Codable, Identifiable {
    var id: String { feature }
    let feature: String
    let label: String?
    let value: Double
    let unit: String?
    let valueInterpretation: String?

    enum CodingKeys: String, CodingKey {
        case feature, label, value, unit
        case valueInterpretation = "value_interpretation"
    }
}

struct V2SignalDescription: Codable {
    let summary: String?
    let vocalFeatures: [V2VocalFeature]?

    enum CodingKeys: String, CodingKey {
        case summary
        case vocalFeatures = "vocal_features"
    }
}

struct V2Signal: Codable, Identifiable {
    var id: String { name }
    let name: String
    let label: String?
    let score: Double
    let level: String
    let flagged: Bool
    let recommendedAction: String?
    let description: V2SignalDescription?

    enum CodingKeys: String, CodingKey {
        case name, label, score, level, flagged
        case recommendedAction = "recommended_action"
        case description
    }

    var displayName: String { SignalBand.displayName(name: name, apiLabel: label) }
    var band: DisplayBand { SignalBand.band(name: name, level: level) }
}

struct V2ExtendedMetric: Codable, Identifiable {
    var id: String { metricId }
    let metricId: String
    let label: String
    let scoreMean: Double
    let scoreStd: Double
    let lowAnchor: String
    let highAnchor: String

    enum CodingKeys: String, CodingKey {
        case metricId = "metric_id"
        case label
        case scoreMean = "score_mean"
        case scoreStd = "score_std"
        case lowAnchor = "low_anchor"
        case highAnchor = "high_anchor"
    }
}

struct V2AudioQuality: Codable {
    let voicePercentage: Double?
    let audioClarity: Double?
    let issues: [String]?

    enum CodingKeys: String, CodingKey {
        case voicePercentage = "voice_percentage"
        case audioClarity = "audio_clarity"
        case issues
    }
}

struct V2Summary: Codable {
    let primarySignals: [String]?
    let overallLevel: String?
    let recommendedAction: String?
    let flaggedCount: Int?
    let description: V2SignalDescription?

    enum CodingKeys: String, CodingKey {
        case primarySignals = "primary_signals"
        case overallLevel = "overall_level"
        case recommendedAction = "recommended_action"
        case flaggedCount = "flagged_count"
        case description
    }
}

struct V2Result: Codable {
    let signals: [V2Signal]?
    let signal: V2Signal?
    let extendedMetrics: [V2ExtendedMetric]?
    let audioQuality: V2AudioQuality?
    let summary: V2Summary?

    enum CodingKeys: String, CodingKey {
        case signals, signal
        case extendedMetrics = "extended_metrics"
        case audioQuality = "audio_quality"
        case summary
    }

    /// Condition jobs carry a single `signal`; model/use-case jobs carry `signals[]`.
    var allSignals: [V2Signal] { signals ?? signal.map { [$0] } ?? [] }
}

struct V2JobDetail: Codable {
    let jobId: String
    let status: String
    let createdAt: String?
    let completedAt: String?
    let result: V2Result?
    let audioDurationSeconds: Double?
    let audioSampleRate: Double?
    let modelName: String?

    enum CodingKeys: String, CodingKey {
        case jobId = "job_id"
        case status
        case createdAt = "created_at"
        case completedAt = "completed_at"
        case result
        case audioDurationSeconds = "audio_duration_seconds"
        case audioSampleRate = "audio_sample_rate"
        case modelName = "model_name"
    }

    var isTerminal: Bool { ["done", "failed", "timed-out"].contains(status.lowercased()) }
    var isDone: Bool { status.lowercased() == "done" }
}

/// One of the 8 Amplifier voice models the `analyzeAudio` function allowlists.
enum SerasonaModel: String, CaseIterable, Identifiable {
    case pulse, clarity, haven, tide, aria, breath, harbor, apex
    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .pulse: return "Pulse — Daily Wellness"
        case .clarity: return "Clarity — Cognitive"
        case .haven: return "Haven — Mental & Behavioral Health"
        case .tide: return "Tide — Cardiometabolic"
        case .aria: return "Aria — Women's Health"
        case .breath: return "Breath — Respiratory"
        case .harbor: return "Harbor — Recovery"
        case .apex: return "Apex — Full Panel"
        }
    }
}

/// A completed check-in, as rendered on the result screen and saved to history.
struct CheckIn: Identifiable, Codable {
    let id: String
    let capturedAt: Date
    let model: String
    let signals: [V2Signal]
    let overallLevel: String?
    let flaggedCount: Int
    let totalSignals: Int

    var worstBand: DisplayBand {
        signals.map(\.band).max {
            (DisplayBand.order.firstIndex(of: $0) ?? -1) < (DisplayBand.order.firstIndex(of: $1) ?? -1)
        } ?? .inconclusive
    }

    var overallState: OverallState {
        signals.isEmpty ? .inconclusive : .from(worstBand: worstBand)
    }

    static func from(job: V2JobDetail) -> CheckIn {
        let result = job.result ?? V2Result(signals: nil, signal: nil, extendedMetrics: nil, audioQuality: nil, summary: nil)
        let signals = result.allSignals
        let bands = signals.map { SignalBand.band(name: $0.name, level: $0.level) }
        let flagged = bands.filter(\.isFlagged).count
        let capturedAtString = job.completedAt ?? job.createdAt
        let capturedAt = capturedAtString.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date()
        return CheckIn(
            id: job.jobId,
            capturedAt: capturedAt,
            model: job.modelName ?? "pulse",
            signals: signals,
            overallLevel: result.summary?.overallLevel,
            flaggedCount: flagged,
            totalSignals: signals.count
        )
    }
}
