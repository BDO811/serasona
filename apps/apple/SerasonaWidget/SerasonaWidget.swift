import WidgetKit
import SwiftUI

/// iOS counterpart to `SerasonaComplication` — the same `SharedStore` read,
/// the same never-refresh timeline (it only changes when the app or watch
/// writes a new result), just rendered for home-screen and iOS lock-screen
/// families instead of watch-face ones.
struct SerasonaWidgetEntry: TimelineEntry {
    let date: Date
    let state: OverallState
    let checkInDate: Date?
}

struct SerasonaWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> SerasonaWidgetEntry {
        SerasonaWidgetEntry(date: Date(), state: .clear, checkInDate: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SerasonaWidgetEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SerasonaWidgetEntry>) -> Void) {
        completion(Timeline(entries: [currentEntry()], policy: .never))
    }

    private func currentEntry() -> SerasonaWidgetEntry {
        SerasonaWidgetEntry(date: Date(), state: SharedStore.latestState ?? .inconclusive, checkInDate: SharedStore.latestDate)
    }
}

struct SerasonaWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SerasonaWidgetEntry

    var body: some View {
        switch family {
        case .systemSmall: SmallHomeView(entry: entry)
        case .systemMedium: MediumHomeView(entry: entry)
        case .accessoryCircular: CircularLockView(entry: entry)
        case .accessoryRectangular: RectangularLockView(entry: entry)
        case .accessoryInline: Label(title, systemImage: "waveform")
        default: Text(title)
        }
    }

    private var title: String { entry.state == .inconclusive ? "Serasona" : entry.state.rawValue }
}

private struct SmallHomeView: View {
    let entry: SerasonaWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
            Text("SERASONA")
                .serasonaStyle(SerasonaType.eyebrow)
                .foregroundStyle(SerasonaColor.inkMuted)

            Spacer()

            Circle()
                .fill(entry.state.softBackground)
                .overlay(Circle().stroke(entry.state.color, lineWidth: 3))
                .frame(width: 44, height: 44)

            Text(entry.state == .inconclusive ? "No check-in yet" : entry.state.rawValue)
                .serasonaStyle(SerasonaType.titleMD)
                .foregroundStyle(SerasonaColor.inkStrong)

            if let date = entry.checkInDate {
                Text(date, style: .relative)
                    .serasonaStyle(SerasonaType.readoutSM)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }
        }
        .padding(SerasonaSpace.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct MediumHomeView: View {
    let entry: SerasonaWidgetEntry

    var body: some View {
        HStack(spacing: SerasonaSpace.s5) {
            Circle()
                .fill(entry.state.softBackground)
                .overlay(Circle().stroke(entry.state.color, lineWidth: 4))
                .frame(width: 56, height: 56)
                .overlay(
                    Text(entry.state == .inconclusive ? "—" : String(entry.state.rawValue.prefix(1)))
                        .serasonaStyle(SerasonaType.titleLG)
                        .foregroundStyle(entry.state.color)
                )

            VStack(alignment: .leading, spacing: SerasonaSpace.s1) {
                Text("SERASONA")
                    .serasonaStyle(SerasonaType.eyebrow)
                    .foregroundStyle(SerasonaColor.inkMuted)
                Text(entry.state == .inconclusive ? "No check-in yet" : entry.state.rawValue)
                    .serasonaStyle(SerasonaType.titleLG)
                    .foregroundStyle(SerasonaColor.inkStrong)
                if let date = entry.checkInDate {
                    Text("Last check-in \(date.formatted(.relative(presentation: .named)))")
                        .serasonaStyle(SerasonaType.caption)
                        .foregroundStyle(SerasonaColor.inkMuted)
                } else {
                    Text("Tap to start your first check-in")
                        .serasonaStyle(SerasonaType.caption)
                        .foregroundStyle(SerasonaColor.inkMuted)
                }
            }

            Spacer()
        }
        .padding(SerasonaSpace.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct CircularLockView: View {
    let entry: SerasonaWidgetEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            Circle()
                .stroke(entry.state.color, lineWidth: 3)
                .padding(2)
            Text(entry.state == .inconclusive ? "—" : String(entry.state.rawValue.prefix(1)))
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(entry.state.color)
        }
    }
}

private struct RectangularLockView: View {
    let entry: SerasonaWidgetEntry

    var body: some View {
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
    }
}

@main
struct SerasonaWidgetBundle: WidgetBundle {
    init() {
        SerasonaFontRegistrar.registerAll()
    }

    var body: some Widget {
        SerasonaWidget()
    }
}

struct SerasonaWidget: Widget {
    let kind = "SerasonaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SerasonaWidgetProvider()) { entry in
            SerasonaWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) { WidgetContainerBackground() }
        }
        .configurationDisplayName("Serasona")
        .description("Your latest check-in, at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

/// Home-screen families get the cream canvas; lock-screen accessory families
/// must stay transparent so the system's own material shows through.
private struct WidgetContainerBackground: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .systemSmall, .systemMedium, .systemLarge: SerasonaColor.surfaceCanvas
        default: Color.clear
        }
    }
}
