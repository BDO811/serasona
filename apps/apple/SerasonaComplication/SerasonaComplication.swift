import WidgetKit
import SwiftUI

struct SerasonaEntry: TimelineEntry {
    let date: Date
    let state: OverallState
    let checkInDate: Date?
}

struct SerasonaTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> SerasonaEntry {
        SerasonaEntry(date: Date(), state: .clear, checkInDate: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SerasonaEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SerasonaEntry>) -> Void) {
        // The complication only ever changes when the app or watch extension
        // writes a new result, so a single-entry, never-refresh timeline is
        // correct here rather than a recurring schedule.
        let timeline = Timeline(entries: [currentEntry()], policy: .never)
        completion(timeline)
    }

    private func currentEntry() -> SerasonaEntry {
        SerasonaEntry(date: Date(), state: SharedStore.latestState ?? .inconclusive, checkInDate: SharedStore.latestDate)
    }
}

struct SerasonaComplicationEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SerasonaEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Circle()
                    .stroke(entry.state.color, lineWidth: 3)
                    .padding(2)
                Text(entry.state == .inconclusive ? "—" : String(entry.state.rawValue.prefix(1)))
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(entry.state.color)
            }

        case .accessoryRectangular:
            HStack(spacing: 6) {
                Circle().fill(entry.state.color).frame(width: 8, height: 8)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Serasona")
                        .font(.system(size: 12, weight: .semibold))
                    Text(entry.state == .inconclusive ? "No check-in yet" : entry.state.rawValue)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }

        case .accessoryInline:
            Label(entry.state == .inconclusive ? "Serasona" : entry.state.rawValue, systemImage: "waveform")

        default:
            Text(entry.state.rawValue)
        }
    }
}

@main
struct SerasonaComplication: Widget {
    let kind = "SerasonaComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SerasonaTimelineProvider()) { entry in
            SerasonaComplicationEntryView(entry: entry)
        }
        .configurationDisplayName("Serasona")
        .description("Your latest check-in, at a glance.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
