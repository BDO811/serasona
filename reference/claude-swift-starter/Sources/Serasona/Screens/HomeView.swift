import SwiftUI

struct HomeView: View {
    @Environment(CheckInStore.self) private var store
    @State private var showingCheckIn = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Serasona.Space.s6) {
                    header

                    if let latest = store.latest {
                        latestCard(latest)
                    } else {
                        emptyStateCard
                    }

                    SerasonaPrimaryButton(title: store.latest == nil ? "Start check-in" : "Check in again") {
                        showingCheckIn = true
                    }

                    if store.history.count > 1 {
                        recentStrip
                    }
                }
                .padding(Serasona.Space.s4)
            }
            .background(Serasona.Surface.canvas)
            .toolbar(.hidden)
        }
        .sheet(isPresented: $showingCheckIn) {
            CheckInView { result in
                store.add(result)
            }
        }
    }

    private var header: some View {
        HStack {
            SerasonaLogo(height: 18)
            Spacer()
        }
        .padding(.top, Serasona.Space.s2)
    }

    private var emptyStateCard: some View {
        SerasonaCard {
            Text("TODAY").serasonaEyebrowStyle()
            Text("Twenty seconds.\nKnow how you're doing.")
                .font(.serasonaDisplayMD)
                .foregroundStyle(Serasona.Ink.strong)
            Text("Say a few sentences and Serasona reads stress, mood, energy and four more signals from your voice.")
                .font(.serasonaBody)
                .foregroundStyle(Serasona.Ink.body)
        }
    }

    private func latestCard(_ result: CheckInResult) -> some View {
        SerasonaCard {
            Text(result.date.formatted(date: .abbreviated, time: .shortened))
                .serasonaEyebrowStyle()
            SerasonaStateBanner(band: result.band, detail: summarySentence(for: result))
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Serasona.Space.s3) {
                ForEach(WellnessMetric.allCases) { metric in
                    SerasonaMetricTile(
                        label: metric.rawValue,
                        value: result.scores[metric] ?? 0,
                        color: Serasona.Ink.strong,
                        softColor: Serasona.Surface.sunken
                    )
                }
            }
        }
    }

    private func summarySentence(for result: CheckInResult) -> String {
        switch result.band {
        case .clear: "Your signals are steady against your baseline."
        case .watch: "A couple of signals are drifting. Worth a second check-in later."
        case .strained: "Several signals are off your baseline today."
        }
    }

    private var recentStrip: some View {
        VStack(alignment: .leading, spacing: Serasona.Space.s2) {
            Text("RECENT").serasonaEyebrowStyle()
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Serasona.Space.s3) {
                    ForEach(store.history.dropFirst().prefix(10)) { result in
                        VStack(spacing: Serasona.Space.s2) {
                            Circle()
                                .fill(result.band.color)
                                .frame(width: 10, height: 10)
                            Text(result.date.formatted(.dateTime.month(.abbreviated).day()))
                                .font(.serasonaCaption)
                                .foregroundStyle(Serasona.Ink.muted)
                        }
                        .padding(Serasona.Space.s3)
                        .background(Serasona.Surface.raised, in: RoundedRectangle(cornerRadius: Serasona.Radius.md))
                    }
                }
            }
        }
    }
}

#Preview {
    HomeView()
        .environment(CheckInStore())
}
