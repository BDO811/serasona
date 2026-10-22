import SwiftUI
import SerasonaKit

struct HistoryView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var sessions: [StoredSession] = []
    @State private var isLoading = false
    @State private var loadError: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                } else if let loadError {
                    ContentUnavailableFallback(message: loadError) {
                        Task { await load() }
                    }
                } else if sessions.isEmpty {
                    ContentUnavailableFallback(message: "No check-ins yet. Your first one will show up here.", action: nil)
                } else {
                    List(sessions.sorted(by: { $0.capturedAt > $1.capturedAt })) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Date(timeIntervalSince1970: item.capturedAt / 1000), style: .date)
                                .font(.subheadline.weight(.semibold))
                            HStack {
                                Text((item.model ?? "pulse").capitalized)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Spacer()
                                if let flagged = item.summary?.flaggedCount, let total = item.summary?.totalSignals {
                                    Text("\(flagged)/\(total) flagged")
                                        .font(.caption)
                                        .foregroundStyle(flagged > 0 ? .orange : .secondary)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .refreshable { await load() }
                }
            }
            .navigationTitle("History")
            .task { await load() }
        }
    }

    private func load() async {
        guard let idToken = await session.validIdToken() else {
            loadError = "Sign in to see your history."
            return
        }
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            sessions = try await session.history.fetchHistory(idToken: idToken, strict: true)
        } catch {
            loadError = (error as? SerasonaError)?.errorDescription ?? error.localizedDescription
        }
    }
}

private struct ContentUnavailableFallback: View {
    let message: String
    let action: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "waveform.slash")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)
            if let action {
                Button("Retry", action: action)
            }
        }
    }
}
