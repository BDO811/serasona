import SwiftUI
import SerasonaKit

struct WatchCheckinView: View {
    @EnvironmentObject private var session: SessionManager
    @StateObject private var model = CheckinViewModel()

    var body: some View {
        content
            .onAppear { model.configure(session) }
    }

    @ViewBuilder
    private var content: some View {
        switch model.stage {
        case .idle:
            VStack(spacing: 8) {
                Image(systemName: "waveform.circle.fill")
                    .font(.system(size: 40))
                Button("Start") { Task { await model.startRecording() } }
                    .buttonStyle(.borderedProminent)
            }
        case .recording:
            VStack(spacing: 8) {
                Text(String(format: "%.0fs", model.recorder.elapsed))
                    .font(.system(size: 28, weight: .semibold, design: .monospaced))
                Button("Stop", role: .destructive) { Task { await model.stopAndAnalyze() } }
            }
        case .uploading:
            VStack(spacing: 8) {
                ProgressView()
                Text("Reading…").font(.caption2)
            }
        case .result(let job):
            let action = RecommendedAction(raw: job.result?.summary?.recommendedAction)
            let flagged = (job.result?.signals ?? []).filter {
                SignalBanding.isFlagged(SignalBanding.band(forSignalNamed: $0.name, level: $0.level, score: $0.score))
            }.count
            VStack(spacing: 6) {
                Text(action.label)
                    .font(.headline)
                    .multilineTextAlignment(.center)
                Text("\(flagged) flagged")
                    .font(.caption)
                    .foregroundStyle(flagged > 0 ? .orange : .secondary)
                Button("Done") { model.reset() }
            }
            .padding(.horizontal, 4)
        case .failed(let message):
            VStack(spacing: 6) {
                Text(message)
                    .font(.caption2)
                    .multilineTextAlignment(.center)
                Button("Retry") { model.reset() }
            }
            .padding(.horizontal, 4)
        }
    }
}
