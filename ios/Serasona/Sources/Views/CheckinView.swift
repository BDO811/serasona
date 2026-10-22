import SwiftUI
import SerasonaKit

struct CheckinView: View {
    @EnvironmentObject private var session: SessionManager
    @StateObject private var model = CheckinViewModel()

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Check-in")
                .onAppear { model.configure(session) }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.stage {
        case .idle:
            idleView
        case .recording:
            recordingView
        case .uploading:
            uploadingView
        case .result(let job):
            ResultView(job: job, model: model.selectedModel) { model.reset() }
        case .failed(let message):
            failedView(message)
        }
    }

    private var idleView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "waveform.circle.fill")
                .font(.system(size: 88))
                .foregroundStyle(.tint)
            Text("Talk for about 30 seconds, as you normally would.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)

            Picker("Pathway", selection: $model.selectedModel) {
                ForEach(SerasonaModel.allCases, id: \.self) { m in
                    Text(m.rawValue.capitalized).tag(m)
                }
            }
            .pickerStyle(.menu)

            Button {
                Task { await model.startRecording() }
            } label: {
                Label("Start check-in", systemImage: "mic.fill")
                    .frame(maxWidth: .infinity)
                    .padding()
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var recordingView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "mic.fill")
                .font(.system(size: 88))
                .foregroundStyle(.red)
                .symbolEffect(.pulse, isActive: true)
            Text(String(format: "%.0fs", model.recorder.elapsed))
                .font(.system(size: 40, weight: .semibold, design: .monospaced))
            Button {
                Task { await model.stopAndAnalyze() }
            } label: {
                Label("Stop and analyze", systemImage: "stop.fill")
                    .frame(maxWidth: .infinity)
                    .padding()
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .padding(.horizontal, 32)
            Spacer()
        }
    }

    private var uploadingView: some View {
        VStack(spacing: 20) {
            Spacer()
            ProgressView()
                .controlSize(.large)
            Text("Reading your voice — this can take up to a couple of minutes.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)
            Spacer()
        }
    }

    private func failedView(_ message: String) -> some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.orange)
            Text(message)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Try again") { model.reset() }
                .buttonStyle(.borderedProminent)
            Spacer()
        }
    }
}
