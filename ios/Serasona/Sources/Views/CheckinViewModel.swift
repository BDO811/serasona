import Foundation
import SerasonaKit

@MainActor
final class CheckinViewModel: ObservableObject {
    enum Stage: Equatable {
        case idle
        case recording
        case uploading
        case result(VoiceJob)
        case failed(String)
    }

    @Published var stage: Stage = .idle
    @Published var selectedModel: SerasonaModel = .pulse

    private var session: SessionManager?
    let recorder = AudioRecorder()

    /// `SessionManager` comes from the SwiftUI environment, which isn't
    /// available at `@StateObject` init time, so the view binds it in
    /// `.onAppear` instead of passing it through the initializer.
    func configure(_ session: SessionManager) {
        self.session = session
    }

    func startRecording() async {
        await recorder.requestPermissionAndStart()
        if recorder.isRecording {
            stage = .recording
        } else if let error = recorder.lastError {
            stage = .failed(error)
        }
    }

    func stopAndAnalyze() async {
        guard let audio = recorder.stop(), !audio.isEmpty else {
            stage = .failed("That recording was too short to analyze. Try again with about 30 seconds of talking.")
            return
        }
        guard let session else {
            stage = .failed("Sign in to run a check-in.")
            return
        }
        guard let idToken = await session.validIdToken() else {
            stage = .failed("Sign in to run a check-in.")
            return
        }
        stage = .uploading
        do {
            let job = try await session.analyzer.analyze(audio: audio, model: selectedModel, idToken: idToken)
            stage = .result(job)
            await persist(job)
        } catch {
            stage = .failed((error as? SerasonaError)?.errorDescription ?? error.localizedDescription)
        }
    }

    private func persist(_ job: VoiceJob) async {
        guard let session, let idToken = await session.validIdToken() else { return }
        let signals = job.result?.signals ?? []
        let summary = job.result?.summary.map {
            StoredSummary(
                overallLevel: $0.overallLevel,
                recommendedAction: $0.recommendedAction,
                flaggedCount: signals.filter { SignalBanding.isFlagged(SignalBanding.band(forSignalNamed: $0.name, level: $0.level, score: $0.score)) }.count,
                totalSignals: signals.count
            )
        }
        let toSave = SessionToSave(jobID: job.jobID, model: selectedModel.rawValue, signals: signals, summary: summary)
        _ = await session.history.saveSession(toSave, idToken: idToken)
    }

    func reset() {
        stage = .idle
    }
}
