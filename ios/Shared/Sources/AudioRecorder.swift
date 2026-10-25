import AVFoundation
import Foundation

/// Records a check-in as AAC-in-M4A, which the server allow-lists directly
/// (`audio/m4a` / `audio/mp4` / `audio/x-m4a` in ALLOWED_AUDIO_MIME_TYPES).
/// Shared between the iOS and watchOS targets — AVAudioRecorder is available
/// on both.
@MainActor
final class AudioRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published private(set) var isRecording = false
    @Published private(set) var elapsed: TimeInterval = 0
    @Published var lastError: String?

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var startedAt: Date?

    /// The Serasona check-in reads best with ~30-60s of continuous speech
    /// (see failureCopy "insufficient_audio" in voice-checkin-client.ts); cut
    /// it off automatically so nobody uploads a multi-minute file by accident.
    static let maxDuration: TimeInterval = 90

    func requestPermissionAndStart() async {
        lastError = nil
        // AVAudioSession.requestRecordPermission is the one microphone-permission
        // API available on both iOS 16+ and watchOS 9+ at this deployment
        // target; AVAudioApplication's replacement needs iOS/watchOS 17+, which
        // would be a silent deployment-target mismatch if used here instead.
        let granted = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) }
        }
        guard granted else {
            lastError = "Microphone access is required for a voice check-in. Enable it in Settings."
            return
        }
        start()
    }

    private func start() {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)
        } catch {
            lastError = "Could not prepare the microphone: \(error.localizedDescription)"
            return
        }
        #endif

        let url = FileManager.default.temporaryDirectory.appendingPathComponent("checkin-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]
        do {
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder?.delegate = self
            recorder?.record()
            isRecording = true
            startedAt = Date()
            elapsed = 0
            timer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self, let startedAt = self.startedAt else { return }
                    self.elapsed = Date().timeIntervalSince(startedAt)
                    if self.elapsed >= Self.maxDuration {
                        self.stop()
                    }
                }
            }
        } catch {
            lastError = "Could not start recording: \(error.localizedDescription)"
        }
    }

    /// Stops recording and returns the captured audio, or nil if nothing
    /// usable was recorded.
    @discardableResult
    func stop() -> Data? {
        timer?.invalidate()
        timer = nil
        guard let recorder else { isRecording = false; return nil }
        let url = recorder.url
        recorder.stop()
        isRecording = false
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
        return try? Data(contentsOf: url)
    }

    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            Task { @MainActor in self.lastError = "The recording stopped unexpectedly." }
        }
    }
}
