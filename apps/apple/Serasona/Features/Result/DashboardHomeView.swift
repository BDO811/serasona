import SwiftUI

/// Open saved results independently of a new recording.
struct DashboardHomeView: View {
    let onRecord: () -> Void
    var injectedHistory: [CheckIn]?
    @State private var history: [CheckIn] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading your dashboard")
                } else if let error {
                    ContentUnavailableView {
                        Label("Dashboard unavailable", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await load() } }
                    }
                } else if let latest = history.max(by: { $0.capturedAt < $1.capturedAt }) {
                    DashboardResultView(checkIn: latest, onRecordAgain: onRecord, injectedHistory: history)
                        .refreshable { await load() }
                } else {
                    ScrollView {
                        VStack(spacing: SerasonaSpace.s6) {
                            HStack(spacing: SerasonaSpace.s6) {
                                ScorePositionScale(value: nil).frame(height: 176)
                                ScoreDial(score: nil, state: .inconclusive)
                            }
                            WebsiteButton()
                            Text("Your dashboard starts with your first check-in.")
                                .serasonaStyle(SerasonaType.titleLG)
                                .multilineTextAlignment(.center)
                            Text("Your score and previous readings will appear here after you record.")
                                .serasonaStyle(SerasonaType.body)
                                .foregroundStyle(SerasonaColor.inkMuted)
                                .multilineTextAlignment(.center)
                            Button("Record my voice", action: onRecord)
                                .buttonStyle(.borderedProminent)
                                .tint(SerasonaColor.ember)
                                .controlSize(.large)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(SerasonaSpace.s6)
                    }
                    .refreshable { await load() }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(SerasonaColor.surfaceCanvas.ignoresSafeArea())
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.inline)
            .task { await load() }
        }
    }

    private func load() async {
        if let injectedHistory {
            history = injectedHistory
            isLoading = false
            return
        }
        isLoading = history.isEmpty
        do {
            history = try await SerasonaAPI.fetchHistory()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct WebsiteButton: View {
    var body: some View {
        Link(destination: SerasonaLegal.website) {
            Label("Open full website", systemImage: "arrow.up.right.square")
                .serasonaStyle(SerasonaType.label)
                .padding(.horizontal, SerasonaSpace.s5)
                .frame(minHeight: 44)
                .foregroundStyle(SerasonaColor.tide)
                .background(SerasonaColor.surfaceRaised)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(SerasonaColor.borderHairline, lineWidth: 1))
        }
    }
}
