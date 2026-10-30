import Foundation

/// The seven Amplifier wellness metrics Serasona reports from a voice check-in.
enum WellnessMetric: String, CaseIterable, Identifiable {
    case stress = "Stress"
    case mood = "Mood"
    case energy = "Energy"
    case confidence = "Confidence"
    case mentalFatigue = "Mental fatigue"
    case alertness = "Alertness"
    case focus = "Focus"

    var id: String { rawValue }
}

struct CheckInResult: Identifiable {
    let id = UUID()
    let date: Date
    let band: Serasona.State.Band
    let scores: [WellnessMetric: Int]
    let audioURL: URL?

    /// Placeholder scoring until the Serasona LAM tenant is wired up.
    /// TODO: replace with a real call to Serasona's analyzeAudio / voiceLongitudinal endpoint.
    static func placeholder(audioURL: URL?) -> CheckInResult {
        var scores: [WellnessMetric: Int] = [:]
        for metric in WellnessMetric.allCases {
            scores[metric] = Int.random(in: 42...88)
        }
        let average = scores.values.reduce(0, +) / max(scores.count, 1)
        let band: Serasona.State.Band = switch average {
        case ..<55: .strained
        case 55..<72: .watch
        default: .clear
        }
        return CheckInResult(date: .now, band: band, scores: scores, audioURL: audioURL)
    }
}

@Observable
final class CheckInStore {
    private(set) var history: [CheckInResult] = []

    func add(_ result: CheckInResult) {
        history.insert(result, at: 0)
    }

    var latest: CheckInResult? { history.first }
}
