import SwiftUI

// MARK: - Capture
//
// The check-in screen, laid out the way serasona.com lays it out
// (`QuestionFlowVisualizer.tsx`): an instrument frame with corner
// brackets, a status readout top left, the question count top right, the
// prompt held in the middle of the screen, and one large round control low
// on the page that becomes a countdown ring, a live waveform strip and a
// number while a take runs.
//
// Two questions, twenty seconds each, with the same speech gate the web
// uses: a take that didn't capture enough talking doesn't fail the
// check-in, it re-asks that slot with a *fresh* prompt from the pool,
// because asking someone the identical question again reads as the app not
// having listened.

enum CheckInFlowState {
    case capture
    case processing
    case result(CheckIn)
    case failed(String)
}

@MainActor
final class CheckInFlowViewModel: ObservableObject {
    @Published var state: CheckInFlowState = .capture
    @Published var selectedModel: SerasonaModel = .pulse
    @Published var showPaywall = false

    /// The record control stays dead until the microphone is actually
    /// available. Before this gate existed on the web the button was live
    /// from first paint, and a tap landing before the stream arrived
    /// started neither the recorder nor the meter loop, which reported as a
    /// zero-second take.
    @Published private(set) var isReady = false
    @Published private(set) var questions: [String]
    @Published private(set) var currentQuestion = 0
    @Published private(set) var warning: String?

    let recorder = AudioRecorder()

    private var takes: [URL] = []
    private var pool: [String]
    private var poolCursor: Int

    init() {
        let pool = CheckInQuestions.shuffledPool()
        self.pool = pool
        self.questions = Array(pool.prefix(CheckInQuestions.perCheckIn))
        self.poolCursor = CheckInQuestions.perCheckIn
    }

    // MARK: Permission

    func prepare() async {
        isReady = await recorder.requestPermission()
        if !isReady {
            warning = "Serasona needs microphone access to hear a check-in. Enable it in Settings."
        }
    }

    // MARK: Takes

    func toggleRecording() {
        if recorder.isRecording {
            // Stopping is all this does. The take is collected on the
            // isRecording transition, so the manual stop and the automatic
            // twenty-second stop run through one path instead of two that
            // can both fire for the same take.
            recorder.stop()
        } else {
            warning = nil
            do {
                try recorder.start(maxDuration: AudioRecorder.takeDuration)
            } catch {
                state = .failed("Couldn't start recording: \(error.localizedDescription)")
            }
        }
    }

    /// Called once, on the recording-to-stopped transition, whether the
    /// take was stopped by hand or by running its full length.
    func takeEnded() {
        guard let take = recorder.finishTake() else {
            warning = "We didn't catch that one. Let's try again."
            return
        }

        guard take.speechSeconds >= AudioRecorder.minimumSpeechSeconds else {
            try? FileManager.default.removeItem(at: take.url)
            warning = "Only \(Int(take.speechSeconds))s of speech captured. Here's a different question."
            questions[currentQuestion] = nextPoolQuestion()
            return
        }

        warning = nil
        takes.append(take.url)

        if currentQuestion + 1 < questions.count {
            currentQuestion += 1
        } else {
            analyze()
        }
    }

    private func nextPoolQuestion() -> String {
        if poolCursor >= pool.count {
            pool = CheckInQuestions.shuffledPool()
            poolCursor = 0
        }
        defer { poolCursor += 1 }
        return pool[poolCursor]
    }

    // MARK: Analysis

    private func analyze() {
        state = .processing
        let takes = self.takes
        let model = selectedModel

        Task {
            do {
                let merged = try await TakeMerger.merge(takes)
                let job = try await SerasonaAPI.analyzeAudio(fileURL: merged, model: model)
                try? FileManager.default.removeItem(at: merged)

                guard job.isDone else {
                    state = .failed("The analysis didn't complete (\(job.status)). Try another check-in.")
                    return
                }

                let checkIn = CheckIn.from(job: job)
                do {
                    try await SerasonaAPI.saveHistory(checkIn)
                } catch {
                    // The check-in itself succeeded — only saving it to
                    // history failed. Never let that take down the result
                    // screen; the one case worth surfacing is the free-tier
                    // limit, as a paywall.
                    if case SerasonaAPIError.freeCheckInUsed = error { showPaywall = true }
                }
                SharedStore.recordLatest(state: checkIn.overallState, date: checkIn.capturedAt)
                self.takes = []
                state = .result(checkIn)
            } catch {
                state = .failed(error.localizedDescription)
            }
        }
    }

    // MARK: Reset

    func reset() {
        recorder.discard()
        for url in takes { try? FileManager.default.removeItem(at: url) }
        takes = []
        currentQuestion = 0
        warning = nil
        pool = CheckInQuestions.shuffledPool()
        questions = Array(pool.prefix(CheckInQuestions.perCheckIn))
        poolCursor = CheckInQuestions.perCheckIn
        state = .capture
    }
}

struct CaptureFlowView: View {
    @StateObject private var viewModel = CheckInFlowViewModel()

    var body: some View {
        ZStack {
            SerasonaColor.surfaceCanvas.ignoresSafeArea()

            switch viewModel.state {
            case .capture:
                QuestionFlowView(viewModel: viewModel, recorder: viewModel.recorder)
            case .processing:
                ProcessingView()
            case .result(let checkIn):
                DashboardResultView(checkIn: checkIn, onRecordAgain: viewModel.reset)
            case .failed(let message):
                CaptureErrorView(message: message, onRetry: viewModel.reset)
            }
        }
        .task { await viewModel.prepare() }
        .sheet(isPresented: $viewModel.showPaywall) {
            PaywallView(onDismiss: { viewModel.showPaywall = false })
        }
    }
}

// MARK: - The question flow

private struct QuestionFlowView: View {
    @ObservedObject var viewModel: CheckInFlowViewModel
    @ObservedObject var recorder: AudioRecorder

    private let buttonSize: CGFloat = 132

    var body: some View {
        ZStack {
            InstrumentFrame()

            VStack(spacing: 0) {
                statusRow
                Spacer()
                questionBlock
                Spacer()
                control
                Spacer().frame(height: SerasonaSpace.s8)
                progressDots
            }
            .padding(SerasonaSpace.s8)
        }
        .onChange(of: recorder.isRecording) { wasRecording, isRecording in
            // The recorder stops itself at twenty seconds. Nothing else
            // tells the flow the take is over.
            if wasRecording && !isRecording { viewModel.takeEnded() }
        }
    }

    // MARK: Chrome

    private var statusRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: SerasonaSpace.s1) {
                HStack(spacing: SerasonaSpace.s2) {
                    Circle()
                        .fill(recorder.isRecording ? SerasonaColor.ember : SerasonaColor.inkMuted)
                        .frame(width: 8, height: 8)
                        .opacity(recorder.isRecording ? 1 : 0.5)
                        .animation(
                            recorder.isRecording
                                ? .easeInOut(duration: 0.6).repeatForever(autoreverses: true)
                                : .default,
                            value: recorder.isRecording
                        )
                    readout(recorder.isRecording ? "SYS.REC" : "SYS.RDY", color: SerasonaColor.inkStrong)
                }

                // The web's metadata slot. Here it carries the one thing
                // this screen actually needs to expose: which model reads
                // the audio.
                Menu {
                    Picker("Model", selection: $viewModel.selectedModel) {
                        ForEach(SerasonaModel.allCases) { model in
                            Text(model.displayName).tag(model)
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        readout("MODEL:", color: SerasonaColor.inkMuted)
                        readout(viewModel.selectedModel.rawValue.uppercased(), color: SerasonaColor.ember)
                    }
                }
                .disabled(recorder.isRecording)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: SerasonaSpace.s1) {
                readout(
                    "QUESTION \(viewModel.currentQuestion + 1) OF \(viewModel.questions.count)",
                    color: SerasonaColor.inkStrong
                )
                HStack(spacing: 4) {
                    readout("HARM:", color: SerasonaColor.inkMuted)
                    readout("DETECT", color: SerasonaColor.ember)
                }
            }
        }
    }

    private func readout(_ text: String, color: Color) -> some View {
        Text(text)
            .serasonaStyle(SerasonaType.readoutSM)
            .tracking(1.6)
            .foregroundStyle(color)
    }

    // MARK: Question

    private var questionBlock: some View {
        VStack(spacing: SerasonaSpace.s6) {
            Text(viewModel.questions[viewModel.currentQuestion])
                .serasonaStyle(SerasonaType.displaySM)
                .foregroundStyle(SerasonaColor.inkStrong)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .id(viewModel.currentQuestion)

            if recorder.isRecording {
                Text("Recording. Keep talking.")
                    .serasonaStyle(SerasonaType.body)
                    .foregroundStyle(SerasonaColor.inkMuted)
            } else if let warning = viewModel.warning {
                Text(warning)
                    .serasonaStyle(SerasonaType.body)
                    .foregroundStyle(SerasonaColor.stateWatch)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Press start, then answer out loud.")
                    .serasonaStyle(SerasonaType.body)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: viewModel.currentQuestion)
    }

    // MARK: Control

    private var control: some View {
        ZStack {
            if recorder.isRecording {
                ScannerRing(size: buttonSize * 1.5)
                CountdownRing(
                    remaining: Double(recorder.secondsLeft) / AudioRecorder.takeDuration,
                    size: buttonSize * 0.85
                )
                WaveformStrip(levels: recorder.levels)
                    .frame(width: buttonSize * 2.4, height: buttonSize * 0.5)
                    .allowsHitTesting(false)
            }

            Button(action: viewModel.toggleRecording) {
                ZStack {
                    Circle()
                        .fill(recorder.isRecording ? SerasonaColor.surfaceEmberSoft : SerasonaColor.surfaceRaised)
                        .overlay(
                            Circle().stroke(
                                recorder.isRecording ? SerasonaColor.ember : SerasonaColor.borderHairline,
                                lineWidth: recorder.isRecording ? 2 : 1
                            )
                        )
                        .shadow(
                            color: SerasonaColor.shadowEmberTint.opacity(recorder.isRecording ? 0.3 : 0.12),
                            radius: recorder.isRecording ? 24 : 12,
                            y: 6
                        )

                    if recorder.isRecording {
                        Text("\(recorder.secondsLeft)")
                            .serasonaStyle(SerasonaType.scoreLG)
                            .monospacedDigit()
                            .foregroundStyle(SerasonaColor.inkStrong)
                    } else {
                        Text("START")
                            .serasonaStyle(SerasonaType.timer)
                            .tracking(2.4)
                            .foregroundStyle(SerasonaColor.inkStrong)
                    }
                }
                .frame(width: buttonSize, height: buttonSize)
            }
            .buttonStyle(.plain)
            .disabled(!viewModel.isReady)
            .opacity(viewModel.isReady ? 1 : 0.4)
            .accessibilityLabel(recorder.isRecording ? "Stop recording" : "Start recording")
            .accessibilityHint(
                recorder.isRecording
                    ? "\(recorder.secondsLeft) seconds left"
                    : "Records up to \(Int(AudioRecorder.takeDuration)) seconds"
            )
        }
        .frame(height: buttonSize * 1.5)
    }

    // MARK: Dots

    private var progressDots: some View {
        HStack(spacing: SerasonaSpace.s3) {
            ForEach(viewModel.questions.indices, id: \.self) { index in
                Circle()
                    .fill(dotColor(index))
                    .frame(width: 8, height: 8)
            }
        }
        .accessibilityHidden(true)
    }

    private func dotColor(_ index: Int) -> Color {
        if index < viewModel.currentQuestion { return SerasonaColor.inkStrong }
        if index == viewModel.currentQuestion { return SerasonaColor.ember }
        return SerasonaColor.borderHairline
    }
}

// MARK: - Instrument chrome

/// The inset rule and four corner brackets. Purely decorative, and the
/// reason a twenty-second silence reads as something measuring rather than
/// a screen that has stopped responding.
private struct InstrumentFrame: View {
    private let inset: CGFloat = 20
    private let bracket: CGFloat = 24

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Rectangle()
                    .stroke(SerasonaColor.borderHairline, lineWidth: 1)
                    .padding(inset)

                ForEach(Corner.allCases) { corner in
                    Bracket(length: bracket)
                        .stroke(SerasonaColor.borderHairline, lineWidth: 1)
                        .frame(width: bracket, height: bracket)
                        .rotationEffect(.degrees(corner.rotation))
                        .position(corner.point(in: geometry.size, inset: inset + 4, bracket: bracket))
                }
            }
        }
        .allowsHitTesting(false)
    }

    enum Corner: String, CaseIterable, Identifiable {
        case topLeft, topRight, bottomRight, bottomLeft
        var id: String { rawValue }

        var rotation: Double {
            switch self {
            case .topLeft: return 0
            case .topRight: return 90
            case .bottomRight: return 180
            case .bottomLeft: return 270
            }
        }

        func point(in size: CGSize, inset: CGFloat, bracket: CGFloat) -> CGPoint {
            let half = bracket / 2
            switch self {
            case .topLeft: return CGPoint(x: inset + half, y: inset + half)
            case .topRight: return CGPoint(x: size.width - inset - half, y: inset + half)
            case .bottomRight: return CGPoint(x: size.width - inset - half, y: size.height - inset - half)
            case .bottomLeft: return CGPoint(x: inset + half, y: size.height - inset - half)
            }
        }
    }

    /// An L drawn from the origin: top edge and left edge. Rotating it in
    /// quarter turns gives all four corners from one shape.
    struct Bracket: Shape {
        let length: CGFloat

        func path(in rect: CGRect) -> Path {
            var path = Path()
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.minX + length, y: rect.minY))
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + length))
            return path
        }
    }
}

/// Counts down rather than up, so the ring empties as the take runs out.
private struct CountdownRing: View {
    let remaining: Double
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().stroke(SerasonaColor.borderHairline, lineWidth: 2)
            Circle()
                .trim(from: 0, to: max(0, min(1, remaining)))
                .stroke(SerasonaColor.ember, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 1), value: remaining)
        }
        .frame(width: size, height: size)
        .allowsHitTesting(false)
    }
}

/// A slow sweep around the control. It carries no information and is the
/// only thing on screen that says the app is still listening through a
/// long pause.
private struct ScannerRing: View {
    let size: CGFloat
    @State private var angle: Double = 0

    var body: some View {
        Circle()
            .strokeBorder(
                AngularGradient(
                    colors: [.clear, SerasonaColor.ember.opacity(0.3), .clear],
                    center: .center
                ),
                lineWidth: 14
            )
            .frame(width: size, height: size)
            .rotationEffect(.degrees(angle))
            .allowsHitTesting(false)
            .onAppear {
                withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) { angle = 360 }
            }
    }
}

/// The live microphone as a bar strip across the control, newest sample on
/// the right so it scrolls past rather than jittering in place. The shared
/// `Waveform` draws one level with per-bar jitter; this one draws real
/// history, which is what the web screen shows.
private struct WaveformStrip: View {
    let levels: [Float]

    var body: some View {
        GeometryReader { geometry in
            let count = max(levels.count, 1)
            let spacing: CGFloat = 3
            let barWidth = max((geometry.size.width - spacing * CGFloat(count - 1)) / CGFloat(count), 1)

            HStack(alignment: .center, spacing: spacing) {
                ForEach(levels.indices, id: \.self) { index in
                    Capsule()
                        .fill(SerasonaColor.inkStrong.opacity(0.7))
                        .frame(width: barWidth, height: max(geometry.size.height * CGFloat(levels[index]), 3))
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height, alignment: .center)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Failure

private struct CaptureErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: SerasonaSpace.s6) {
            Spacer()
            Image("alert")
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 40, height: 40)
                .foregroundStyle(SerasonaColor.stateStrained)

            Text(message)
                .serasonaStyle(SerasonaType.body)
                .foregroundStyle(SerasonaColor.inkBody)
                .multilineTextAlignment(.center)
                .padding(.horizontal, SerasonaSpace.s8)

            Button("Try again", action: onRetry)
                .serasonaStyle(SerasonaType.label)
                .foregroundStyle(SerasonaColor.tide)
            Spacer()
        }
    }
}
