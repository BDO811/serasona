import AVFoundation
import Observation

/// Captures a short voice check-in. Records real microphone audio to a local
/// temporary file and publishes a live amplitude level for the waveform.
/// Does not talk to any backend yet — see RESULT TODO in CheckInView.
@MainActor
@Observable
final class CheckInRecorder: NSObject {
    enum State: Equatable {
        case idle
        case requestingPermission
        case permissionDenied
        case recording
        case finished(URL)
    }

    private(set) var state: State = .idle
    private(set) var level: Float = 0 // 0...1, smoothed
    private(set) var elapsed: TimeInterval = 0

    let duration: TimeInterval = 20

    private var recorder: AVAudioRecorder?
    private var timer: Timer?

    func start() {
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            beginRecording()
        case .denied:
            state = .permissionDenied
        case .undetermined:
            state = .requestingPermission
            AVAudioApplication.requestRecordPermission { [weak self] granted in
                Task { @MainActor in
                    guard let self else { return }
                    self.state = granted ? .idle : .permissionDenied
                    if granted { self.beginRecording() }
                }
            }
        @unknown default:
            state = .permissionDenied
        }
    }

    private func beginRecording() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement)
            try session.setActive(true)
        } catch {
            state = .permissionDenied
            return
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("serasona-checkin-\(UUID().uuidString)")
            .appendingPathExtension("m4a")

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]

        do {
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.isMeteringEnabled = true
            recorder.delegate = self
            recorder.record()
            self.recorder = recorder
            self.elapsed = 0
            self.state = .recording
            startTimer()
        } catch {
            state = .permissionDenied
        }
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    private func tick() {
        guard let recorder, state == .recording else { return }
        recorder.updateMeters()
        let db = recorder.averagePower(forChannel: 0)
        let linear = pow(10, db / 20) // 0...1
        level = level * 0.7 + Float(max(0, min(1, linear * 4))) * 0.3
        elapsed += 1.0 / 30.0
        if elapsed >= duration {
            stop()
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        guard let recorder else { return }
        recorder.stop()
        state = .finished(recorder.url)
        self.recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func reset() {
        timer?.invalidate()
        timer = nil
        recorder?.stop()
        recorder = nil
        level = 0
        elapsed = 0
        state = .idle
    }
}

extension CheckInRecorder: AVAudioRecorderDelegate {
    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {}
}
