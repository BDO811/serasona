import SwiftUI

struct HomeView: View {
    @State private var showCheckIn = false
    let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("TODAY'S READING")
                        .font(SerasonaType.eyebrow)
                        .tracking(1.6)
                        .foregroundColor(.inkMuted)
                    Text("Serasona")
                        .font(SerasonaType.display(28, weight: .semibold))
                        .foregroundColor(.inkStrong)
                }

                HStack {
                    Spacer()
                    ScoreDial(score: SampleData.overallScore, band: SampleData.overallBand)
                    Spacer()
                }

                Button {
                    showCheckIn = true
                } label: {
                    Text("Start check-in")
                        .font(SerasonaType.titleMd)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                }
                .background(Color.ember)
                .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.lg, style: .continuous))
                .shadow(color: Color.ember.opacity(0.28), radius: 20, y: 6)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Seven signals")
                        .font(SerasonaType.titleLg)
                        .foregroundColor(.inkStrong)
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(SampleData.metrics) { metric in
                            MetricCard(metric: metric)
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(Color.surfaceCanvas.ignoresSafeArea())
        .fullScreenCover(isPresented: $showCheckIn) {
            CheckInView()
        }
    }
}

#Preview {
    HomeView()
}
