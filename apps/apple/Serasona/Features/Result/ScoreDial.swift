import SwiftUI

/// The result screen's hero: an arc dial reading the Serasona Score, matching
/// the design system's `stroke-dial` (12pt arc at 176px default).
///
/// `score` is the weighted composite from `SerasonaScore.compute` (nil when
/// every present signal was inconclusive, which draws an empty track rather
/// than a fabricated reading). `state` is still Clear/Watch/Strained for the
/// word under the number — see OverallState.
struct ScoreDial: View {
    let score: Int?
    let state: OverallState

    private var progress: Double {
        guard let score else { return 0 }
        return Double(score) / 100
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(SerasonaColor.surfaceSunken, lineWidth: 12)

            if score != nil {
              Circle()
                .trim(from: 0, to: max(0, min(1, progress)))
                .stroke(score.map { AssessmentRung.of($0).color } ?? state.color, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.6), value: progress)
            }

            VStack(spacing: SerasonaSpace.s1) {
                if let score {
                    Text("\(score)")
                        .serasonaStyle(SerasonaType.scoreLG)
                        .foregroundStyle(SerasonaColor.inkStrong)
                } else {
                    Text("—")
                        .serasonaStyle(SerasonaType.scoreLG)
                        .foregroundStyle(SerasonaColor.inkMuted)
                }

                Text(score == nil ? "No reading" : state.rawValue)
                    .serasonaStyle(SerasonaType.caption)
                    .foregroundStyle(state.color)
            }
        }
        .frame(width: 176, height: 176)
    }
}
