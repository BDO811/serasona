import SwiftUI
import SerasonaKit

struct ResultView: View {
    let job: VoiceJob
    let model: SerasonaModel
    let onDone: () -> Void

    private var signals: [SignalReading] { job.result?.signals ?? [] }
    private var headline: [SerasonaMetrics.Resolved] {
        SerasonaMetrics.resolve(from: job.result?.extendedMetrics ?? [])
    }
    private var action: RecommendedAction {
        RecommendedAction(raw: job.result?.summary?.recommendedAction)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(action.label)
                        .font(.title2.bold())
                    if let summary = job.result?.summary?.description?.summary {
                        Text(summary)
                            .foregroundStyle(.secondary)
                    }
                }

                if !headline.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("AT A GLANCE")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        ForEach(headline) { metric in
                            HStack {
                                Text(metric.label)
                                Spacer()
                                if let score = metric.score, let band = metric.band {
                                    Text("\(score)")
                                        .font(.body.monospacedDigit())
                                    Text(band.rawValue)
                                        .font(.caption.weight(.semibold))
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(color(for: band), in: Capsule())
                                        .foregroundStyle(.white)
                                } else {
                                    Text("—").foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }

                if !signals.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("SIGNALS")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        ForEach(signals, id: \.name) { signal in
                            let band = SignalBanding.band(forSignalNamed: signal.name, level: signal.level, score: signal.score)
                            HStack {
                                Text(signal.label)
                                Spacer()
                                Text(band.rawValue)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(bandColor(band))
                            }
                        }
                    }
                }

                Button("Done", action: onDone)
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
            }
            .padding()
        }
    }

    private func color(for band: SerasonaMetrics.Band) -> Color {
        switch band {
        case .clear: return .teal
        case .watch: return .orange
        case .strained: return .pink
        }
    }

    private func bandColor(_ band: DisplayBand) -> Color {
        switch band {
        case .normal: return .teal
        case .low: return .yellow
        case .moderate: return .orange
        case .elevated: return .pink
        case .inconclusive: return .secondary
        }
    }
}
