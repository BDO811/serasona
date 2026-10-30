import Charts
import SwiftUI

/// The "becomes your own 30-day baseline" view `OnboardingView` promises —
/// an overall Clear/Watch/Strained trend across recent check-ins, plus a
/// per-signal score trend for whichever signal the person picks. Shown above
/// the plain list in `HistoryView` once there's enough history to read as a
/// trend rather than noise.
struct HistoryTrendView: View {
    /// Oldest first, matching `SerasonaAPI.fetchHistory()`'s own ordering.
    let checkIns: [CheckIn]

    @State private var selectedSignalName: String?

    private static let baselineWindow: TimeInterval = 30 * 24 * 60 * 60

    private var windowed: [CheckIn] {
        let cutoff = Date().addingTimeInterval(-Self.baselineWindow)
        return checkIns.filter { $0.capturedAt >= cutoff }
    }

    /// Unique signal names across the window, ordered by first appearance so
    /// the picker reads in the same order the model returns signals.
    private var availableSignals: [(name: String, displayName: String)] {
        var seen = Set<String>()
        var ordered: [(String, String)] = []
        for checkIn in windowed {
            for signal in checkIn.signals where !seen.contains(signal.name) {
                seen.insert(signal.name)
                ordered.append((signal.name, signal.displayName))
            }
        }
        return ordered
    }

    var body: some View {
        if windowed.count < 3 {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: SerasonaSpace.s4) {
                Text("YOUR 30-DAY BASELINE")
                    .serasonaStyle(SerasonaType.eyebrow)
                    .foregroundStyle(SerasonaColor.inkMuted)

                overallChart

                if let selectedSignalName, let signal = availableSignals.first(where: { $0.name == selectedSignalName }) {
                    signalPicker
                    signalChart(name: signal.name)
                } else if !availableSignals.isEmpty {
                    signalPicker
                }
            }
            .padding(SerasonaSpace.s5)
            .background(SerasonaColor.surfaceRaised)
            .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
            .padding(.horizontal, SerasonaSpace.s4)
            .padding(.top, SerasonaSpace.s2)
            .onAppear {
                if selectedSignalName == nil { selectedSignalName = availableSignals.first?.name }
            }
        }
    }

    // MARK: - Overall state trend

    private var overallChart: some View {
        let points = windowed.compactMap { checkIn -> (CheckIn, Double)? in
            guard let ordinal = overallOrdinal(checkIn.overallState) else { return nil }
            return (checkIn, ordinal)
        }

        return Chart {
            ForEach(points, id: \.0.id) { checkIn, ordinal in
                LineMark(x: .value("Date", checkIn.capturedAt), y: .value("State", ordinal))
                    .foregroundStyle(SerasonaColor.chartBand)
                    .interpolationMethod(.monotone)
                PointMark(x: .value("Date", checkIn.capturedAt), y: .value("State", ordinal))
                    .foregroundStyle(checkIn.overallState.color)
                    .symbolSize(60)
            }
        }
        .chartYScale(domain: -0.3...2.3)
        .chartYAxis {
            AxisMarks(values: [0, 1, 2]) { value in
                AxisGridLine().foregroundStyle(SerasonaColor.chartGrid)
                AxisValueLabel {
                    if let intValue = value.as(Double.self) {
                        Text(overallLabel(for: intValue))
                            .serasonaStyle(SerasonaType.caption)
                            .foregroundStyle(SerasonaColor.inkMuted)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: 7)) { _ in
                AxisGridLine().foregroundStyle(SerasonaColor.chartGrid)
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    .font(.custom(SerasonaFontName.dmMonoRegular, size: 10))
                    .foregroundStyle(SerasonaColor.inkMuted)
            }
        }
        .frame(height: 140)
    }

    private func overallOrdinal(_ state: OverallState) -> Double? {
        switch state {
        case .clear: return 0
        case .watch: return 1
        case .strained: return 2
        case .inconclusive: return nil
        }
    }

    private func overallLabel(for ordinal: Double) -> String {
        switch ordinal {
        case 0: return "Clear"
        case 1: return "Watch"
        case 2: return "Strained"
        default: return ""
        }
    }

    // MARK: - Per-signal trend

    private var signalPicker: some View {
        Picker("Signal", selection: Binding(
            get: { selectedSignalName ?? availableSignals.first?.name ?? "" },
            set: { selectedSignalName = $0 }
        )) {
            ForEach(availableSignals, id: \.name) { signal in
                Text(signal.displayName).tag(signal.name)
            }
        }
        .pickerStyle(.menu)
        .tint(SerasonaColor.tide)
    }

    private func signalChart(name: String) -> some View {
        let points: [(id: String, date: Date, signal: V2Signal)] = windowed.compactMap { checkIn in
            guard let signal = checkIn.signals.first(where: { $0.name == name }) else { return nil }
            return (checkIn.id, checkIn.capturedAt, signal)
        }

        return Chart {
            ForEach(points, id: \.id) { point in
                LineMark(x: .value("Date", point.date), y: .value("Score", point.signal.score))
                    .foregroundStyle(SerasonaColor.tide)
                    .interpolationMethod(.monotone)
                PointMark(x: .value("Date", point.date), y: .value("Score", point.signal.score))
                    .foregroundStyle(SignalBand.color(name: point.signal.name, band: point.signal.band))
                    .symbolSize(50)
            }
        }
        .chartYScale(domain: 0...1)
        .chartYAxis {
            AxisMarks(position: .leading) { _ in
                AxisGridLine().foregroundStyle(SerasonaColor.chartGrid)
            }
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: 7)) { _ in
                AxisGridLine().foregroundStyle(SerasonaColor.chartGrid)
                AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    .font(.custom(SerasonaFontName.dmMonoRegular, size: 10))
                    .foregroundStyle(SerasonaColor.inkMuted)
            }
        }
        .frame(height: 120)
    }
}
