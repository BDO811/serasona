import SwiftUI

struct ResultView: View {
    let checkIn: CheckIn
    let onDone: () -> Void

    @State private var recommendations: String = ""
    @State private var loadingRecommendations = true

    private var serasonaScore: SerasonaScoreResult? { SerasonaScore.compute(signals: checkIn.signals) }

    var body: some View {
        ScrollView {
            VStack(spacing: SerasonaSpace.s8) {
                VStack(spacing: SerasonaSpace.s4) {
                    Text(checkIn.capturedAt, style: .time)
                        .serasonaStyle(SerasonaType.eyebrow)
                        .foregroundStyle(SerasonaColor.inkMuted)

                    Text("SERASONA SCORE")
                        .serasonaStyle(SerasonaType.eyebrow)
                        .foregroundStyle(SerasonaColor.inkMuted)

                    ScoreDial(score: serasonaScore?.score, state: checkIn.overallState)
                }
                .padding(.top, SerasonaSpace.s10)

                if let groups = serasonaScore?.groups, !groups.isEmpty {
                    VStack(spacing: SerasonaSpace.s3) {
                        ForEach(groups) { group in
                            GroupTile(group: group)
                        }
                    }
                    .padding(.horizontal, SerasonaSpace.s4)
                }

                if !recommendations.isEmpty {
                    VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
                        Text("WHAT TO DO")
                            .serasonaStyle(SerasonaType.eyebrow)
                            .foregroundStyle(SerasonaColor.inkMuted)
                        Text(recommendations)
                            .serasonaStyle(SerasonaType.body)
                            .foregroundStyle(SerasonaColor.inkBody)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(SerasonaSpace.s5)
                    .background(SerasonaColor.surfaceEmberSoft)
                    .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
                    .padding(.horizontal, SerasonaSpace.s4)
                } else if loadingRecommendations && checkIn.flaggedCount > 0 {
                    ProgressView().padding(.horizontal, SerasonaSpace.s4)
                }

                VStack(alignment: .leading, spacing: SerasonaSpace.s3) {
                    Text("SIGNALS")
                        .serasonaStyle(SerasonaType.eyebrow)
                        .foregroundStyle(SerasonaColor.inkMuted)
                        .padding(.horizontal, SerasonaSpace.s4)

                    ForEach(checkIn.signals) { signal in
                        MetricTile(signal: signal)
                    }
                    .padding(.horizontal, SerasonaSpace.s4)
                }

                Button(action: onDone) {
                    Text("Done")
                        .serasonaStyle(SerasonaType.label)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, SerasonaSpace.s4)
                        .foregroundStyle(SerasonaColor.inkOnEmber)
                        .background(SerasonaColor.ember)
                        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.lg))
                }
                .padding(.horizontal, SerasonaSpace.s4)
                .padding(.bottom, SerasonaSpace.s8)
            }
        }
        .background(SerasonaColor.surfaceCanvas.ignoresSafeArea())
        .task {
            loadingRecommendations = true
            recommendations = (try? await SerasonaAPI.recommendations(assessment: checkIn.model, signals: checkIn.signals)) ?? ""
            loadingRecommendations = false
        }
    }
}
