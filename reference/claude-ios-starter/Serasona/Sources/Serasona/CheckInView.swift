import SwiftUI

private enum Stage {
    case capture
    case result
}

struct CheckInView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var stage: Stage = .capture
    @State private var secondsLeft = 20
    @State private var recording = false
    @State private var timer: Timer?

    var body: some View {
        Group {
            switch stage {
            case .capture: captureStage
            case .result: ResultStage(onDone: { dismiss() })
            }
        }
    }

    private var captureStage: some View {
        VStack(spacing: 40) {
            HStack {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .foregroundColor(.inkInverse)
                        .padding(10)
                        .background(Color.white.opacity(0.08))
                        .clipShape(Circle())
                }
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            Spacer()

            VStack(spacing: 12) {
                Text(recording ? "Reading seven signals" : "Speak for twenty seconds")
                    .font(SerasonaType.titleLg)
                    .foregroundColor(.inkInverse)
                Text(String(format: "0:%02d", secondsLeft))
                    .font(SerasonaType.timer)
                    .tracking(2)
                    .foregroundColor(.inkInverse.opacity(0.7))
            }

            WaveformBars(active: recording)
                .frame(height: 48)
                .padding(.horizontal, 32)

            Button {
                toggleRecording()
            } label: {
                Circle()
                    .fill(Color.ember)
                    .frame(width: 84, height: 84)
                    .overlay(
                        Image(systemName: recording ? "stop.fill" : "mic.fill")
                            .font(.system(size: 28))
                            .foregroundColor(.white)
                    )
                    .shadow(color: Color.ember.opacity(0.4), radius: 24, y: 8)
            }

            Spacer()
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surfaceInverse.ignoresSafeArea())
    }

    private func toggleRecording() {
        if recording {
            stop()
        } else {
            recording = true
            secondsLeft = 20
            timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
                if secondsLeft > 0 {
                    secondsLeft -= 1
                } else {
                    stop()
                }
            }
        }
    }

    private func stop() {
        timer?.invalidate()
        timer = nil
        recording = false
        stage = .result
    }
}

private struct ResultStage: View {
    let onDone: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("TODAY'S READING")
                        .font(SerasonaType.eyebrow)
                        .tracking(1.6)
                        .foregroundColor(.inkMuted)
                    Text("Here's what moved")
                        .font(SerasonaType.display(28, weight: .semibold))
                        .foregroundColor(.inkStrong)
                }

                HStack {
                    Spacer()
                    ScoreDial(score: SampleData.overallScore, band: SampleData.overallBand)
                    Spacer()
                }

                VStack(spacing: 0) {
                    ForEach(Array(SampleData.metrics.enumerated()), id: \.element.id) { index, metric in
                        HStack {
                            Text(metric.name)
                                .font(SerasonaType.titleMd)
                                .foregroundColor(.inkStrong)
                            Spacer()
                            Text(metric.delta >= 0 ? "+\(metric.delta)" : "\(metric.delta)")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(metric.delta >= 0 ? .tide : .stateWatch)
                            BandPill(band: metric.band)
                        }
                        .padding(.vertical, 14)
                        if index < SampleData.metrics.count - 1 {
                            Divider().background(Color.borderHairline)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .background(Color.surfaceRaised)
                .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl, style: .continuous))

                Button(action: onDone) {
                    Text("Done")
                        .font(SerasonaType.titleMd)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                }
                .background(Color.ember)
                .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.lg, style: .continuous))
            }
            .padding(20)
        }
        .background(Color.surfaceCanvas.ignoresSafeArea())
    }
}

#Preview {
    CheckInView()
}
