import Foundation

struct Metric: Identifiable {
    let id = UUID()
    let name: String
    let value: Int
    let delta: Int
    let band: Band
}

enum SampleData {
    // Placeholder values for the first build. Real values come from
    // Serasona's voice analysis once the check-in flow is wired to the
    // analyzeAudioPublic / voiceLongitudinalPublic endpoints.
    static let overallScore = 72
    static let overallBand = Band.watch

    static let metrics: [Metric] = [
        Metric(name: "Stress", value: 58, delta: -4, band: .watch),
        Metric(name: "Mood", value: 81, delta: 6, band: .clear),
        Metric(name: "Energy", value: 64, delta: 2, band: .clear),
        Metric(name: "Confidence", value: 77, delta: 3, band: .clear),
        Metric(name: "Mental Fatigue", value: 45, delta: -9, band: .strained),
        Metric(name: "Alertness", value: 69, delta: 1, band: .clear),
        Metric(name: "Focus", value: 71, delta: 0, band: .clear),
    ]
}
