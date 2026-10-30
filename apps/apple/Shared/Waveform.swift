import SwiftUI

/// A live amplitude bar row, matching `waveform-active` / `waveform-idle`.
/// Shared between the iOS capture flow and the watchOS check-in flow.
struct Waveform: View {
    let level: Float
    private let barCount = 24
    @State private var heights: [CGFloat] = []

    var body: some View {
        GeometryReader { geo in
            HStack(alignment: .center, spacing: 3) {
                ForEach(0..<barCount, id: \.self) { i in
                    RoundedRectangle(cornerRadius: SerasonaRadius.xs)
                        .fill(level > 0.05 ? SerasonaColor.waveformActive : SerasonaColor.waveformIdle)
                        .frame(height: barHeight(for: i, in: geo.size.height))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .animation(.easeOut(duration: 0.1), value: level)
        }
    }

    private func barHeight(for index: Int, in maxHeight: CGFloat) -> CGFloat {
        let base = CGFloat(level)
        // A simple per-bar pseudo-random jitter so the bars aren't all identical.
        let jitter = CGFloat((index * 37) % 13) / 13
        let mixed = min(1, base * (0.5 + 0.5 * jitter) + 0.06)
        return max(4, mixed * maxHeight)
    }
}
