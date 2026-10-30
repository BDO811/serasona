import SwiftUI

struct HistoryView: View {
    @Environment(CheckInStore.self) private var store

    var body: some View {
        NavigationStack {
            Group {
                if store.history.isEmpty {
                    emptyState
                } else {
                    List(store.history) { result in
                        HStack(spacing: Serasona.Space.s3) {
                            Circle()
                                .fill(result.band.color)
                                .frame(width: 10, height: 10)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(result.band.rawValue)
                                    .font(.serasonaTitleMD)
                                    .foregroundStyle(Serasona.Ink.strong)
                                Text(result.date.formatted(date: .abbreviated, time: .shortened))
                                    .font(.serasonaCaption)
                                    .foregroundStyle(Serasona.Ink.muted)
                            }
                            Spacer()
                        }
                        .listRowBackground(Serasona.Surface.raised)
                        .padding(.vertical, Serasona.Space.s1)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .background(Serasona.Surface.canvas)
                }
            }
            .navigationTitle("History")
            .background(Serasona.Surface.canvas)
        }
    }

    private var emptyState: some View {
        VStack(spacing: Serasona.Space.s3) {
            Text("NOTHING YET").serasonaEyebrowStyle()
            Text("Your check-ins will line up here.")
                .font(.serasonaBody)
                .foregroundStyle(Serasona.Ink.body)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Serasona.Surface.canvas)
    }
}

#Preview {
    HistoryView()
        .environment(CheckInStore())
}
