import SwiftUI

enum WatchFlowState {
    case glance
    case recording
    case processing
    case queued
    case result(CheckIn)
    case failed(String)
}

@MainActor
final class WatchCheckInViewModel: ObservableObject {
    @Published var state: WatchFlowState = .glance
    let recorder = AudioRecorder()

    /// Watch check-ins default to the general wellness model — there's no
    /// room on-wrist for the full 8-model picker the phone app offers.
    private let model: SerasonaModel = .pulse

    func beginRecording() async {
        let granted = await recorder.requestPermission()
        guard granted else {
            state = .failed("Enable microphone access in Settings on your Watch.")
            return
        }
        do {
            try recorder.start()
            state = .recording
        } catch {
            state = .failed("Couldn't start recording.")
        }
    }

    func finishRecording() async {
        guard case .recording = state else { return }
        state = .processing
        recorder.stop()
        guard recorder.elapsed >= AudioRecorder.takeDuration,
              recorder.speechSeconds >= AudioRecorder.minimumSpeechSeconds else {
            recorder.discard()
            state = .failed("Speak for at least 20 seconds in a quiet place, then try again.")
            return
        }
        guard let url = recorder.recordedFileURL else {
            state = .failed("No recording was captured.")
            return
        }
        state = .processing
        do {
            try WatchUploadQueue.shared.enqueue(url)
            recorder.discard()
            await WatchUploadQueue.shared.upload()
            if WatchUploadQueue.shared.pendingCount > 0 { state = .queued }
            else if let result = WatchUploadQueue.shared.latestResult { state = .result(result) }
            else { state = .glance }
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func cancel() {
        recorder.discard()
        state = .glance
    }
}

struct WatchRootView: View {
    @StateObject private var viewModel = WatchCheckInViewModel()
    @ObservedObject private var queue = WatchUploadQueue.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            SerasonaColor.surfaceCanvas.ignoresSafeArea()

            switch viewModel.state {
            case .glance:
                WatchGlanceView(onStartCheckIn: { Task { await viewModel.beginRecording() } })
            case .recording:
                WatchRecordingView(viewModel: viewModel)
            case .processing:
                WatchProcessingView()
            case .queued:
                ScrollView {
                    VStack(spacing: 10) {
                        Text("Saved on your Watch").font(.headline)
                        Text("Reconnect to Wi-Fi or cellular, then tap Upload. Recordings expire after 24 hours when the app runs again.")
                            .font(.footnote).fixedSize(horizontal: false, vertical: true)
                        if let error = queue.error { Text(error).font(.footnote) }
                        Button("Upload now") {
                            Task {
                                await queue.upload()
                                if queue.pendingCount == 0, let result = queue.latestResult { viewModel.state = .result(result) }
                            }
                        }.disabled(queue.isUploading)
                        Button("Done") { viewModel.state = .glance }
                    }.padding(8)
                }
            case .result(let checkIn):
                WatchResultView(checkIn: checkIn, onDone: { viewModel.state = .glance })
            case .failed(let message):
                WatchErrorView(message: message, onRetry: { viewModel.state = .glance })
            }
        }
        .task { await refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await refresh() } }
            if phase == .background, viewModel.recorder.isRecording { viewModel.cancel() }
        }
    }

    private func refresh() async {
        queue.purgeExpired()
        await queue.upload()
        do {
            if let latest = try await SerasonaAPI.fetchHistory().max(by: { $0.capturedAt < $1.capturedAt }) {
                SharedStore.recordLatest(state: latest.overallState, date: latest.capturedAt)
            }
        } catch SerasonaAPIError.notSignedIn {
            WatchAuthService.shared.logOut()
        } catch { /* Preserve the last local reading when offline. */ }
    }
}

private struct WatchGlanceView: View {
    let onStartCheckIn: () -> Void
    @ObservedObject private var queue = WatchUploadQueue.shared
    @AppStorage("serasona.latest.state", store: UserDefaults(suiteName: SharedStore.appGroupID)) private var storedState = ""
    @State private var confirmSignOut = false
    @State private var confirmDiscard = false
    private var state: OverallState { OverallState(rawValue: storedState) ?? .inconclusive }

    var body: some View {
        ScrollView {
          VStack(spacing: 6) {
            Text("SERASONA")
                .serasonaStyle(SerasonaType.eyebrow)
                .foregroundStyle(SerasonaColor.inkMuted)

            Circle()
                .fill(state.softBackground)
                .overlay(Circle().stroke(state.color, lineWidth: 3))
                .frame(width: 60, height: 60)
                .overlay(
                    Text(state == .inconclusive ? "—" : state.rawValue.prefix(1).uppercased())
                        .serasonaStyle(SerasonaType.scoreMD)
                        .foregroundStyle(state.color)
                )

            Text(state == .inconclusive ? "No check-in yet" : state.rawValue)
                .serasonaStyle(SerasonaType.bodySM)
                .foregroundStyle(SerasonaColor.inkBody)

            if let date = SharedStore.latestDate {
                Text(date, style: .relative)
                    .serasonaStyle(SerasonaType.readoutSM)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }

            Button(action: onStartCheckIn) {
                Image("mic")
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 20, height: 20)
                    .foregroundStyle(SerasonaColor.inkOnEmber)
                    .padding(10)
                    .background(SerasonaColor.ember)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Record a voice check-in")
            Text("Speak for 20 to 30 seconds about your sleep, energy, and day.")
                .font(.footnote).fixedSize(horizontal: false, vertical: true)
            Text("Your voice is sent to Serasona for wellness analysis. Offline recordings stay on this Watch for up to 24 hours, then expire when the app runs again.")
                .font(.footnote).fixedSize(horizontal: false, vertical: true)
            if queue.pendingCount > 0 {
                Text("\(queue.pendingCount) saved check-ins").font(.footnote)
                if let error = queue.error { Text(error).font(.footnote) }
                Button("Upload saved check-ins") { Task { await queue.upload() } }.disabled(queue.isUploading)
                Button("Discard saved recordings", role: .destructive) { confirmDiscard = true }.disabled(queue.isUploading)
            }
            Button("Sign out") { confirmSignOut = true }.disabled(queue.isUploading)
            Link("Privacy policy", destination: SerasonaLegal.privacy)
          }
          .padding(8)
        }
        .confirmationDialog("Sign out and remove saved recordings from this Watch?", isPresented: $confirmSignOut) {
            Button("Sign out", role: .destructive) { queue.discardAll(); WatchAuthService.shared.logOut() }
        }
        .confirmationDialog("Discard check-ins that haven't uploaded?", isPresented: $confirmDiscard) {
            Button("Discard", role: .destructive) { queue.discardAll() }
        }
    }
}

private struct WatchRecordingView: View {
    @ObservedObject var viewModel: WatchCheckInViewModel
    @ObservedObject private var recorder: AudioRecorder

    init(viewModel: WatchCheckInViewModel) {
        self.viewModel = viewModel
        self.recorder = viewModel.recorder
    }

    var body: some View {
        VStack(spacing: 8) {
            Text(String(format: "0:%02d", Int(viewModel.recorder.elapsed)))
                .serasonaStyle(SerasonaType.timer)
                .foregroundStyle(SerasonaColor.inkStrong)

            Waveform(level: viewModel.recorder.level)
                .frame(height: 32)

            HStack(spacing: 16) {
                Button(role: .cancel) { viewModel.cancel() } label: {
                    Image("close").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 14, height: 14).padding(8)
                        .foregroundStyle(SerasonaColor.inkMuted)
                        .background(SerasonaColor.surfaceSunken).clipShape(Circle())
                }
                Button { Task { await viewModel.finishRecording() } } label: {
                    Image("check").renderingMode(.template).resizable().scaledToFit()
                        .frame(width: 18, height: 18).padding(10)
                        .foregroundStyle(SerasonaColor.inkOnEmber)
                        .background(SerasonaColor.ember).clipShape(Circle())
                }
                .disabled(recorder.elapsed < AudioRecorder.takeDuration)
            }
            .buttonStyle(.plain)
        }
        .padding(8)
        .onChange(of: recorder.isRecording) { old, new in
            if old && !new, recorder.elapsed >= AudioRecorder.maxDuration {
                Task { await viewModel.finishRecording() }
            }
        }
    }
}

private struct WatchProcessingView: View {
    var body: some View {
        VStack(spacing: 6) {
            ProgressView().tint(SerasonaColor.ember)
            Text("Reading…")
                .serasonaStyle(SerasonaType.bodySM)
                .foregroundStyle(SerasonaColor.inkMuted)
        }
    }
}

private struct WatchResultView: View {
    let checkIn: CheckIn
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text(checkIn.overallState.rawValue)
                    .serasonaStyle(SerasonaType.scoreMD)
                    .foregroundStyle(checkIn.overallState.color)

                Text("\(checkIn.totalSignals - checkIn.flaggedCount)/\(checkIn.totalSignals) normal")
                    .serasonaStyle(SerasonaType.caption)
                    .foregroundStyle(SerasonaColor.inkMuted)

                ForEach(checkIn.signals.prefix(4)) { signal in
                    HStack {
                        Text(signal.displayName)
                            .serasonaStyle(SerasonaType.bodySM)
                            .foregroundStyle(SerasonaColor.inkStrong)
                        Spacer()
                        Text(SignalBand.label(name: signal.name, band: signal.band))
                            .serasonaStyle(SerasonaType.caption)
                            .foregroundStyle(SignalBand.color(name: signal.name, band: signal.band))
                    }
                }

                Button("Done", action: onDone)
                    .serasonaStyle(SerasonaType.label)
                    .foregroundStyle(SerasonaColor.tide)
                    .padding(.top, 4)
            }
            .padding(8)
        }
    }
}

private struct WatchErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        ScrollView {
          VStack(spacing: 8) {
            Text(message)
                .serasonaStyle(SerasonaType.bodySM)
                .foregroundStyle(SerasonaColor.inkBody)
                .multilineTextAlignment(.center)
            Button("Try again", action: onRetry)
                .serasonaStyle(SerasonaType.label)
                .foregroundStyle(SerasonaColor.tide)
        }
          .padding(8)
        }
    }
}
