import SwiftUI

struct ProcessingView: View {
    @State private var startedAt = Date()
    var estimatedSeconds = 60

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let elapsed = max(0, Int(context.date.timeIntervalSince(startedAt)))
            let remaining = max(0, estimatedSeconds - elapsed)
            VStack(spacing: SerasonaSpace.s5) {
                Text("Reading your voice…")
                    .serasonaStyle(SerasonaType.titleLG)
                    .foregroundStyle(SerasonaColor.inkStrong)
                Text(String(format: "%d:%02d", (remaining > 0 ? remaining : elapsed) / 60, (remaining > 0 ? remaining : elapsed) % 60))
                    .serasonaStyle(SerasonaType.scoreLG)
                    .monospacedDigit()
                    .foregroundStyle(SerasonaColor.ember)
                    .accessibilityLabel(remaining > 0 ? "About \(remaining) seconds remaining" : "\(elapsed) seconds elapsed")
                Text(remaining > 0 ? "Estimated time remaining" : "Finishing your reading")
                    .serasonaStyle(SerasonaType.body)
                    .foregroundStyle(SerasonaColor.inkMuted)
                Text(remaining > 0 ? "Your results will appear as soon as they are ready." : "This is taking longer than estimated. Your recording is still being processed.")
                    .serasonaStyle(SerasonaType.bodySM)
                    .foregroundStyle(SerasonaColor.inkMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(SerasonaSpace.s6)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
