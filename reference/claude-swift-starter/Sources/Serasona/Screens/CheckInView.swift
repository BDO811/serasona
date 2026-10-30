import SwiftUI

struct CheckInView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var recorder = CheckInRecorder()
    @State private var phase: Phase = .prompt
    @State private var result: CheckInResult?

    let onFinished: (CheckInResult) -> Void

    private enum Phase {
        case prompt, recording, processing, result
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Serasona.Surface.inverse.ignoresSafeArea()
                VStack(spacing: Serasona.Space.s8) {
                    Spacer()
                    content
                    Spacer()
                    controls
                }
                .padding(Serasona.Space.s6)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        recorder.reset()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(Serasona.Ink.inverse)
                    }
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .onChange(of: recorder.state) { _, newValue in
            if case .finished(let url) = newValue {
                phase = .processing
                Task {
                    try? await Task.sleep(for: .seconds(1.2))
                    let finished = CheckInResult.placeholder(audioURL: url)
                    result = finished
                    phase = .result
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .prompt:
            VStack(spacing: Serasona.Space.s4) {
                Text("A FEW SENTENCES IS ENOUGH")
                    .font(.serasonaEyebrow)
                    .tracking(1.4)
                    .foregroundStyle(Serasona.Ink.inverse.opacity(0.6))
                Text("How has today felt so far?")
                    .font(.serasonaDisplayMD)
                    .foregroundStyle(Serasona.Ink.inverse)
                    .multilineTextAlignment(.center)
            }

        case .recording:
            VStack(spacing: Serasona.Space.s6) {
                Text(timerText)
                    .font(.serasonaTimer)
                    .tracking(2)
                    .foregroundStyle(Serasona.Ink.inverse)
                SerasonaWaveform(level: recorder.level, isActive: true)
                    .frame(height: 72)
            }

        case .processing:
            VStack(spacing: Serasona.Space.s4) {
                ProgressView()
                    .tint(Serasona.Ink.inverse)
                Text("Reading your signals")
                    .font(.serasonaBody)
                    .foregroundStyle(Serasona.Ink.inverse.opacity(0.8))
            }

        case .result:
            if let result {
                VStack(spacing: Serasona.Space.s3) {
                    Text(result.band.rawValue)
                        .font(.serasonaScoreLG)
                        .foregroundStyle(Serasona.Ink.inverse)
                    Text("Full breakdown is waiting on Today.")
                        .font(.serasonaBody)
                        .foregroundStyle(Serasona.Ink.inverse.opacity(0.7))
                }
            }
        }
    }

    private var timerText: String {
        let remaining = max(0, Int(recorder.duration - recorder.elapsed))
        return String(format: "00:%02d", remaining)
    }

    @ViewBuilder
    private var controls: some View {
        switch phase {
        case .prompt:
            if recorder.state == .permissionDenied {
                Text("Serasona needs microphone access. Enable it in Settings to check in.")
                    .font(.serasonaBodySM)
                    .foregroundStyle(Serasona.Ink.inverse.opacity(0.7))
                    .multilineTextAlignment(.center)
            } else {
                recordButton
            }

        case .recording:
            Button {
                recorder.stop()
            } label: {
                stopGlyph
            }

        case .processing:
            EmptyView()

        case .result:
            if let result {
                SerasonaPrimaryButton(title: "Done") {
                    onFinished(result)
                    dismiss()
                }
            }
        }
    }

    private var recordButton: some View {
        Button {
            phase = .recording
            recorder.start()
        } label: {
            ZStack {
                Circle()
                    .fill(Serasona.Accent.ember)
                    .frame(width: 84, height: 84)
                Image(systemName: "mic.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(Serasona.Ink.onEmber)
            }
        }
    }

    private var stopGlyph: some View {
        ZStack {
            Circle()
                .stroke(Serasona.Accent.ember, lineWidth: 4)
                .frame(width: 84, height: 84)
            RoundedRectangle(cornerRadius: 6)
                .fill(Serasona.Accent.ember)
                .frame(width: 28, height: 28)
        }
    }
}

#Preview {
    CheckInView { _ in }
}
