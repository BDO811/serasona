import SwiftUI

struct HistoryView: View {
    @State private var checkIns: [CheckIn] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                SerasonaColor.surfaceCanvas.ignoresSafeArea()

                if isLoading {
                    ProgressView()
                } else if let errorMessage {
                    VStack(spacing: SerasonaSpace.s3) {
                        Text(errorMessage)
                            .serasonaStyle(SerasonaType.body)
                            .foregroundStyle(SerasonaColor.inkMuted)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, SerasonaSpace.s8)
                        Button("Retry") { Task { await load() } }
                            .serasonaStyle(SerasonaType.label)
                            .foregroundStyle(SerasonaColor.tide)
                    }
                } else if checkIns.isEmpty {
                    Text("No check-ins yet. Your first one will show up here.")
                        .serasonaStyle(SerasonaType.body)
                        .foregroundStyle(SerasonaColor.inkMuted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, SerasonaSpace.s8)
                } else {
                    List {
                        Section {
                            ForEach(checkIns.reversed()) { checkIn in
                                HistoryRow(checkIn: checkIn)
                                    .listRowBackground(SerasonaColor.surfaceCanvas)
                            }
                        } header: {
                            HistoryTrendView(checkIns: checkIns)
                                .listRowInsets(EdgeInsets())
                                .textCase(nil)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { await load() }
                }
            }
            .navigationTitle("History")
            .task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            checkIns = try await SerasonaAPI.fetchHistory()
        } catch SerasonaAPIError.noIdentity {
            errorMessage = "Add an email in Settings to start saving check-ins."
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

private struct HistoryRow: View {
    let checkIn: CheckIn

    var body: some View {
        HStack(spacing: SerasonaSpace.s4) {
            Circle()
                .fill(checkIn.overallState.color)
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: SerasonaSpace.s1) {
                Text(checkIn.capturedAt, style: .date)
                    .serasonaStyle(SerasonaType.titleMD)
                    .foregroundStyle(SerasonaColor.inkStrong)
                Text("\(checkIn.model.capitalized) · \(checkIn.totalSignals - checkIn.flaggedCount)/\(checkIn.totalSignals) normal")
                    .serasonaStyle(SerasonaType.caption)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }

            Spacer()

            Text(checkIn.overallState.rawValue)
                .serasonaStyle(SerasonaType.label)
                .foregroundStyle(checkIn.overallState.color)
        }
        .padding(.vertical, SerasonaSpace.s2)
    }
}
