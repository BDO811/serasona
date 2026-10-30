import AVFoundation
import Combine

/// Records a short check-in to an `.m4a` file (one of `analyzeAudio`'s
/// allowed MIME types) and publishes a live amplitude level for the
/// waveform UI (`SerasonaColor.waveformActive` / `.waveformIdle`).
@MainActor
final class AudioRecorder: NSObject, ObservableObject {
    @Published private(set) var isRecording = false
    @Published private(set) var elapsed: TimeInterval = 0
    @Published private(set) var level: Float = 0 // 0...1, smoothed

    /// Seconds remaining in the current take, for the countdown ring and
    /// the number inside the record control.
    @Published private(set) var secondsLeft: Int = 0

    /// How much of this take registered as actual speech rather than room
    /// tone, measured against the adaptive floor below. The question flow
    /// checks this when a take ends and re-asks rather than accepting a
    /// mostly-silent clip.
    @Published private(set) var speechSeconds: TimeInterval = 0

    /// Newest sample last, 0...1, one entry per bar in the waveform strip.
    @Published private(set) var levels: [Float] = Array(repeating: 0, count: AudioRecorder.barCount)

    /// Serasona's check-ins are short by design — stop automatically at this
    /// length so a check-in can't accidentally turn into an ambient recording.
    static let maxDuration: TimeInterval = 30

    /// One question's take in the two-question check-in flow.
    ///
    /// Twenty, not fifteen. The model refuses anything under fifteen
    /// seconds, and a clip that is only just long enough is a clip that
    /// fails intermittently for reasons nobody can see: an encoder frame
    /// boundary, a stop that lands a few milliseconds early, or trailing
    /// silence trimmed upstream all put it under the floor.
    static let takeDuration: TimeInterval = 20

    /// A take with less real speech than this is re-asked.
    static let minimumSpeechSeconds: TimeInterval = 10

    /// How many bars the live waveform strip draws.
    static let barCount = 48

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var limit: TimeInterval = AudioRecorder.maxDuration
    /// Adaptive floor and ceiling. A fixed threshold either misses a soft
    /// voice in a quiet room or counts a television as speech.
    private var noiseFloor: Float = 0.01
    private var peak: Float = 0.02
    private let tickInterval: TimeInterval = 0.05
    private(set) var recordedFileURL: URL?

    func requestPermission() async -> Bool {
        // `AVAudioSession.requestRecordPermission` rather than the newer
        // `AVAudioApplication.requestRecordPermission` (iOS 17+ only) so this
        // one path compiles and runs unchanged on both the iOS and watchOS
        // targets, which share this file.
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func start(maxDuration: TimeInterval = AudioRecorder.maxDuration) throws {
        limit = maxDuration
        let session = AVAudioSession.sharedInstance()
        // `.defaultToSpeaker` is iOS-only (unavailable on watchOS) — this file
        // is shared with the watchOS targets, so gate it per platform.
        #if os(iOS)
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        #else
        try session.setCategory(.playAndRecord, mode: .default)
        #endif
        try session.setActive(true)

        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]

        let recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder.isMeteringEnabled = true
        recorder.delegate = self
        recorder.record()

        self.recorder = recorder
        self.recordedFileURL = url
        self.isRecording = true
        self.elapsed = 0
        self.secondsLeft = Int(limit)
        self.speechSeconds = 0
        self.noiseFloor = 0.01
        self.peak = 0.02
        self.levels = Array(repeating: 0, count: Self.barCount)

        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    private func tick() {
        guard let recorder, recorder.isRecording else { return }
        recorder.updateMeters()
        // averagePower(forChannel:) is in dBFS, roughly -160...0. Map to 0...1
        // with a floor so silence reads as a flat idle line, not a flicker.
        let db = recorder.averagePower(forChannel: 0)
        let normalized = max(0, (db + 50) / 50)
        level = level * 0.6 + Float(normalized) * 0.4 // smoothing

        // Separately from the smoothed `level` the waveform reads, grade
        // this frame against the room so the speech gate counts talking
        // rather than ambience.
        let linear: Float = db < -55 ? 0 : pow(10, db / 20)
        noiseFloor = min(max(noiseFloor * 0.995 + linear * 0.005, 0.004), 0.08)
        peak = max(peak * 0.995, linear)
        let headroom = max(peak - noiseFloor, 0.01)
        let gated = min(max((linear - noiseFloor) / headroom, 0), 1)
        if gated > 0.15 { speechSeconds += tickInterval }

        var next = levels
        next.removeFirst()
        next.append(gated)
        levels = next

        elapsed = recorder.currentTime
        secondsLeft = max(0, Int((limit - elapsed).rounded(.up)))
        if elapsed >= limit {
            stop()
        }
    }

    /// Ends the take and hands back what it captured. Separate from
    /// `stop()` so the caller gets the file and the speech count together,
    /// and so the next take starts from a clean slate.
    func finishTake() -> (url: URL, speechSeconds: TimeInterval)? {
        let seconds = speechSeconds
        stop()
        guard let url = recordedFileURL else { return nil }
        recordedFileURL = nil
        return (url, seconds)
    }

    func stop() {
        recorder?.stop()
        timer?.invalidate()
        timer = nil
        isRecording = false
        levels = Array(repeating: 0, count: Self.barCount)
        level = 0
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func discard() {
        stop()
        if let url = recordedFileURL { try? FileManager.default.removeItem(at: url) }
        recordedFileURL = nil
        elapsed = 0
        level = 0
    }
}

extension AudioRecorder: AVAudioRecorderDelegate {
    nonisolated func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {}
}
