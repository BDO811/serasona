import Charts
import SwiftUI

// MARK: - DashboardResultView
//
// The results screen, following the serasona.com dashboard
// (`src/pages/Dashboard.tsx`) section for section, with the rotating body
// map left out:
//
//   1. Score banner, and the last three measurements under it
//   2. "Your next check-in starts here" capture row
//   3. Physiologic analysis — full width now, since the body map that used
//      to sit beside it and filter it by region is gone
//   4. Four index cards, each with its own three-reading sparkline
//   5. Assessment summary and the four-rung scale
//   6. Trends & history / Assessment details
//   7. Trend chart, saved-readings matrix, recent check-ins
//   8. Assessment provenance
//
// The web filters the signals panel by tapping a region on the body map.
// With the map gone there is nothing to filter by, so the panel simply
// shows every sign the read returned, which is what it showed anyway with
// no region selected.

struct DashboardResultView: View {
    let checkIn: CheckIn
    let onRecordAgain: () -> Void
    /// Injected history, for previews and UI checks. When nil (every real
    /// caller) the screen fetches its own.
    var injectedHistory: [CheckIn]?

    @State private var history: [CheckIn] = []
    @State private var loadingHistory = true
    @State private var historyError: String?
    @State private var tab: Tab = .trends
    @State private var days = 30
    @State private var explaining = false

    enum Tab: String, CaseIterable, Identifiable {
        case trends, assessment
        var id: String { rawValue }
        var label: String {
            switch self {
            case .trends: return "Trends & history"
            case .assessment: return "Assessment details"
            }
        }
    }

    private var score: SerasonaScoreResult? { SerasonaScore.compute(signals: checkIn.signals) }
    private var sleep: SleepScore.Result? { SleepScore.compute(signals: checkIn.signals) }

    /// The band that belongs beside the composite number.
    ///
    /// NOT `checkIn.overallState`, which is the *worst single band* in the
    /// panel. That is the right word for a one-glance result card, and the
    /// wrong one here: with one elevated sign out of eight it reads
    /// "Strained" directly above three cards reading 73 · Clear and a scale
    /// lit on STRONG. Three different words for one reading, on one screen.
    /// The flagged count and the red band chips still carry the elevated
    /// sign; the number carries the composite.
    private var compositeState: OverallState { score?.band ?? checkIn.overallState }

    /// This check-in always belongs in the history, whether or not the
    /// save round-tripped. A result screen that doesn't include the reading
    /// it is showing is a result screen that looks broken.
    private var allCheckIns: [CheckIn] {
        var combined = history.filter { $0.id != checkIn.id }
        combined.append(checkIn)
        return combined.sorted { $0.capturedAt < $1.capturedAt }
    }

    private var measurements: [DashboardMeasurement] { CheckInHistoryMath.lastThree(allCheckIns) }
    private var visible: [CheckIn] { CheckInHistoryMath.within(allCheckIns, days: days) }
    private var comparable: [CheckIn] { CheckInHistoryMath.comparable(visible, to: visible.last) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SerasonaSpace.s8) {
                scoreBanner
                captureRow
                signalsPanel
                indexCards
                summaryStrip
                tabBar

                switch tab {
                case .trends:
                    trendsPanel
                    matrixPanel
                    recentPanel
                case .assessment:
                    assessmentPanel
                }

                Button("How are these indices calculated?") { explaining = true }
                    .serasonaStyle(SerasonaType.label)
                    .foregroundStyle(SerasonaColor.tide)

                Spacer(minLength: SerasonaSpace.s10)
            }
            .padding(.horizontal, SerasonaSpace.s5)
            .padding(.top, SerasonaSpace.s6)
        }
        .background(SerasonaColor.surfaceCanvas.ignoresSafeArea())
        .task { await loadHistory() }
        .sheet(isPresented: $explaining) {
            ScoreMethodSheet(score: score, sleep: sleep)
        }
    }

    private func loadHistory() async {
        if let injectedHistory {
            history = injectedHistory
            loadingHistory = false
            return
        }
        loadingHistory = true
        do {
            history = try await SerasonaAPI.fetchHistory()
            historyError = nil
        } catch {
            historyError = error.localizedDescription
        }
        loadingHistory = false
    }

    // MARK: 1 — Score banner

    private var scoreBanner: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s5) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
                    Text("YOUR SERASONA SCORE")
                        .serasonaStyle(SerasonaType.eyebrow)
                        .foregroundStyle(SerasonaColor.inkMuted)

                    Text("Your last three measurements. The latest scored check-ins, whenever they were recorded.")
                        .serasonaStyle(SerasonaType.body)
                        .foregroundStyle(SerasonaColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer()

                Button {
                    Task { await loadHistory() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundStyle(SerasonaColor.inkMuted)
                        .padding(SerasonaSpace.s2)
                }
                .disabled(loadingHistory)
                .accessibilityLabel("Refresh results")
            }

            HStack {
                Spacer()
                ScoreDial(score: score?.score, state: compositeState)
                Spacer()
            }

            VStack(spacing: SerasonaSpace.s3) {
                ForEach(Array(measurements.enumerated()), id: \.element.id) { index, measurement in
                    MeasurementCard(
                        measurement: measurement,
                        // Closer to today, a stronger wash of that
                        // reading's own rung color; older cards fade back
                        // toward the plain card.
                        emphasis: [0.26, 0.16, 0.08][min(index, 2)],
                        isLatest: index == 0
                    )
                }
            }

            if let historyError {
                Text(historyError)
                    .serasonaStyle(SerasonaType.caption)
                    .foregroundStyle(SerasonaColor.stateWatch)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: 2 — Capture row

    private var captureRow: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s3) {
            Text("Your next check-in starts here.")
                .serasonaStyle(SerasonaType.titleLG)
                .foregroundStyle(SerasonaColor.inkStrong)

            Text("Speak naturally. Keep your recording source consistent when following a trend.")
                .serasonaStyle(SerasonaType.bodySM)
                .foregroundStyle(SerasonaColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)

            Button(action: onRecordAgain) {
                HStack(spacing: SerasonaSpace.s2) {
                    Image(systemName: "mic.fill")
                    Text("Record my voice")
                }
                .serasonaStyle(SerasonaType.label)
                .frame(maxWidth: .infinity)
                .padding(.vertical, SerasonaSpace.s4)
                .foregroundStyle(SerasonaColor.inkOnEmber)
                .background(SerasonaColor.ember)
                .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.lg))
            }
            .buttonStyle(.plain)
        }
        .padding(SerasonaSpace.s5)
        .background(SerasonaColor.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
    }

    // MARK: 3 — Signals

    private var signalsPanel: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s3) {
            PanelHeading(
                title: "PHYSIOLOGIC ANALYSIS",
                trailing: "\(checkIn.flaggedCount) OF \(checkIn.signals.count) FLAGGED"
            )

            if checkIn.signals.isEmpty {
                Text("No signs were returned for this recording.")
                    .serasonaStyle(SerasonaType.body)
                    .foregroundStyle(SerasonaColor.inkMuted)
            } else {
                ForEach(checkIn.signals) { signal in
                    MetricTile(signal: signal)
                }
            }
        }
    }

    // MARK: 4 — Index cards

    private var indexCards: some View {
        // Newest last, so the sparkline reads left to right in time.
        let slots = Array(measurements.reversed())

        return LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: SerasonaSpace.s3),
                GridItem(.flexible(), spacing: SerasonaSpace.s3),
            ],
            spacing: SerasonaSpace.s3
        ) {
            ForEach(ScoreGroup.allCases) { group in
                IndexCard(
                    label: "\(group.label) Index",
                    value: score?.groups.first { $0.group == group }?.index,
                    history: slots.map { slot in
                        slot.checkIn.flatMap { CheckInHistoryMath.index($0, group: group) }
                    }
                )
            }
            IndexCard(
                label: "Sleep Score",
                value: sleep?.score,
                history: slots.map { slot in
                    slot.checkIn.flatMap { SleepScore.compute(signals: $0.signals)?.score }
                }
            )
        }
    }

    // MARK: 5 — Summary

    @ViewBuilder
    private var summaryStrip: some View {
        if let value = score?.score {
            let rung = AssessmentRung.of(value)
            VStack(alignment: .leading, spacing: SerasonaSpace.s5) {
                HStack(alignment: .top, spacing: SerasonaSpace.s8) {
                    LabeledBlock(label: "PROFILE", value: compositeState.rawValue)
                    LabeledBlock(label: "ASSESSMENT", value: rung.recommendation)
                }
                RungScale(current: rung)
            }
            .padding(SerasonaSpace.s5)
            .background(SerasonaColor.surfaceRaised)
            .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
        }
    }

    // MARK: 6 — Tabs

    private var tabBar: some View {
        HStack(spacing: SerasonaSpace.s2) {
            ForEach(Tab.allCases) { value in
                Button { tab = value } label: {
                    Text(value.label)
                        .serasonaStyle(SerasonaType.label)
                        .foregroundStyle(tab == value ? SerasonaColor.inkInverse : SerasonaColor.inkMuted)
                        .padding(.horizontal, SerasonaSpace.s5)
                        .padding(.vertical, SerasonaSpace.s3)
                        .background(
                            Capsule().fill(tab == value ? SerasonaColor.surfaceInverse : SerasonaColor.surfaceSunken)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(tab == value ? [.isSelected] : [])
            }
        }
    }

    // MARK: 7 — Trends, matrix, recent

    private var trendsPanel: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s4) {
            PanelHeading(title: "TREND", trailing: "\(comparable.count) COMPARABLE")

            HStack(spacing: SerasonaSpace.s2) {
                Text("Saved history period")
                    .serasonaStyle(SerasonaType.caption)
                    .foregroundStyle(SerasonaColor.inkMuted)
                Spacer()
                ForEach([7, 30, 90], id: \.self) { value in
                    Button { days = value } label: {
                        Text("\(value)D")
                            .serasonaStyle(SerasonaType.readoutSM)
                            .foregroundStyle(days == value ? SerasonaColor.inkInverse : SerasonaColor.inkMuted)
                            .padding(.horizontal, SerasonaSpace.s3)
                            .padding(.vertical, SerasonaSpace.s1)
                            .background(
                                Capsule().fill(days == value ? SerasonaColor.surfaceInverse : SerasonaColor.surfaceSunken)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            if comparable.count < 2 {
                Text("A trend needs at least two check-ins read by the same model with the same sign coverage. There \(comparable.count == 1 ? "is 1" : "are \(comparable.count)") in this period.")
                    .serasonaStyle(SerasonaType.bodySM)
                    .foregroundStyle(SerasonaColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Chart(comparable) { entry in
                    if let value = CheckInHistoryMath.score(entry) {
                        LineMark(
                            x: .value("Recorded", entry.capturedAt),
                            y: .value("Score", value)
                        )
                        .foregroundStyle(SerasonaColor.inkMuted)

                        PointMark(
                            x: .value("Recorded", entry.capturedAt),
                            y: .value("Score", value)
                        )
                        .foregroundStyle(AssessmentRung.of(value).color)
                        .symbolSize(80)
                    }
                }
                .chartYScale(domain: 0...100)
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                            .foregroundStyle(SerasonaColor.inkMuted)
                    }
                }
                .frame(height: 170)

                RungLegend()
            }
        }
        .padding(SerasonaSpace.s5)
        .background(SerasonaColor.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
    }

    private var matrixPanel: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s4) {
            PanelHeading(title: "YOUR SAVED READINGS", trailing: "LAST 3")

            Grid(alignment: .leading, horizontalSpacing: SerasonaSpace.s2, verticalSpacing: SerasonaSpace.s2) {
                GridRow {
                    Text("SIGNAL INDEX")
                        .serasonaStyle(SerasonaType.readoutSM)
                        .foregroundStyle(SerasonaColor.inkMuted)
                    ForEach(measurements) { measurement in
                        Text(measurement.capturedAt.map(DateText.short) ?? "—")
                            .serasonaStyle(SerasonaType.readoutSM)
                            .foregroundStyle(SerasonaColor.inkMuted)
                            .frame(maxWidth: .infinity)
                    }
                }

                ForEach(MatrixRow.all) { row in
                    GridRow {
                        Text(row.label)
                            .serasonaStyle(SerasonaType.label)
                            .foregroundStyle(SerasonaColor.inkStrong)
                        ForEach(measurements) { measurement in
                            MatrixCell(value: measurement.checkIn.flatMap(row.value))
                        }
                    }
                }
            }
        }
        .padding(SerasonaSpace.s5)
        .background(SerasonaColor.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
    }

    private var recentPanel: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s4) {
            PanelHeading(title: "RECENT CHECK-INS", trailing: "\(visible.count) IN THIS VIEW")

            if visible.isEmpty {
                Text("Nothing recorded in the last \(days) days.")
                    .serasonaStyle(SerasonaType.bodySM)
                    .foregroundStyle(SerasonaColor.inkMuted)
            } else {
                VStack(spacing: 0) {
                    ForEach(visible.reversed()) { entry in
                        SessionRow(checkIn: entry)
                        if entry.id != visible.first?.id {
                            Divider().overlay(SerasonaColor.borderHairline)
                        }
                    }
                }
            }
        }
        .padding(SerasonaSpace.s5)
        .background(SerasonaColor.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
    }

    // MARK: 8 — Assessment and provenance

    private var assessmentPanel: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s4) {
            PanelHeading(title: "YOUR ASSESSMENT IN CONTEXT", trailing: nil)

            Text("The profile summarizes the returned sign bands. The individual signs above show what was flagged and what came back inconclusive. Provider recommendations and individual flags stay visible even when the composite is high.")
                .serasonaStyle(SerasonaType.bodySM)
                .foregroundStyle(SerasonaColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)

            DisclosureGroup {
                VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
                    ProvenanceRow(label: "STATUS", value: "Analysis complete")
                    ProvenanceRow(label: "DATE", value: DateText.long(checkIn.capturedAt))
                    ProvenanceRow(label: "MODEL", value: checkIn.model)
                    ProvenanceRow(label: "OVERALL LEVEL", value: checkIn.overallLevel ?? "Not recorded")
                    ProvenanceRow(label: "SIGNS READ", value: "\(checkIn.signals.filter { $0.band != .inconclusive }.count) of \(checkIn.totalSignals)")
                    ProvenanceRow(label: "COVERAGE", value: score?.coverageKey.isEmpty == false ? score!.coverageKey : "Not recorded")
                    ProvenanceRow(label: "SCORE VERSION", value: score?.version ?? serasonaScoreVersion)
                    ProvenanceRow(label: "SAVED SESSION ID", value: checkIn.id)
                    ProvenanceRow(label: "METHOD", value: "Vocal biomarker analysis")
                }
                .padding(.top, SerasonaSpace.s3)
            } label: {
                Text("Assessment provenance")
                    .serasonaStyle(SerasonaType.label)
                    .foregroundStyle(SerasonaColor.inkStrong)
            }
            .tint(SerasonaColor.inkMuted)
        }
        .padding(SerasonaSpace.s5)
        .background(SerasonaColor.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
    }
}

// MARK: - Pieces

enum DateText {
    static func short(_ date: Date) -> String {
        date.formatted(.dateTime.month(.abbreviated).day())
    }

    static func long(_ date: Date) -> String {
        date.formatted(date: .abbreviated, time: .shortened)
    }
}

private struct PanelHeading: View {
    let title: String
    let trailing: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .serasonaStyle(SerasonaType.eyebrow)
                .foregroundStyle(SerasonaColor.inkMuted)
            Spacer()
            if let trailing {
                Text(trailing)
                    .serasonaStyle(SerasonaType.readoutSM)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }
        }
    }
}

private struct MeasurementCard: View {
    let measurement: DashboardMeasurement
    let emphasis: Double
    let isLatest: Bool

    var body: some View {
        HStack(alignment: .center, spacing: SerasonaSpace.s4) {
            VStack(alignment: .leading, spacing: 2) {
                Text(measurement.label.uppercased())
                    .serasonaStyle(SerasonaType.eyebrow)
                    .foregroundStyle(SerasonaColor.inkBody)
                Text(measurement.capturedAt.map(DateText.short) ?? "—")
                    .serasonaStyle(SerasonaType.readoutSM)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                if let score = measurement.score {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text("\(score)")
                            .serasonaStyle(SerasonaType.scoreMD)
                            .monospacedDigit()
                            .foregroundStyle(SerasonaColor.inkStrong)
                        Text("/ 100")
                            .serasonaStyle(SerasonaType.caption)
                            .foregroundStyle(SerasonaColor.inkMuted)
                    }
                    Text([measurement.bandLabel, measurement.capturedAt.map { $0.formatted(date: .omitted, time: .shortened) }]
                        .compactMap { $0 }
                        .joined(separator: " · "))
                        .serasonaStyle(SerasonaType.caption)
                        .foregroundStyle(SerasonaColor.inkMuted)
                } else {
                    Text("No saved check-in yet")
                        .serasonaStyle(SerasonaType.bodySM)
                        .foregroundStyle(SerasonaColor.inkMuted)
                }
            }
        }
        .padding(SerasonaSpace.s5)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: SerasonaRadius.lg)
                .stroke(isLatest ? SerasonaColor.borderStrong : SerasonaColor.borderHairline, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    private var background: Color {
        guard let score = measurement.score else { return SerasonaColor.surfaceRaised }
        return AssessmentRung.of(score).color.opacity(emphasis)
    }
}

/// One index, its band word, and the three readings behind it. The line
/// breaks over a missing reading rather than plotting it as zero, since a
/// dip to the floor would read as a genuinely bad reading rather than a gap.
private struct IndexCard: View {
    let label: String
    let value: Int?
    let history: [Int?]

    var body: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
            Text(label.uppercased())
                .serasonaStyle(SerasonaType.eyebrow)
                .foregroundStyle(SerasonaColor.inkBody)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            Text(value.map(String.init) ?? "Not read")
                .serasonaStyle(SerasonaType.scoreMD)
                .monospacedDigit()
                .foregroundStyle(SerasonaColor.inkStrong)

            Text(value.map(ScoreBandLabel.of) ?? "No reading")
                .serasonaStyle(SerasonaType.caption)
                .foregroundStyle(SerasonaColor.inkMuted)

            // No date row. Three dates do not fit across a half-width
            // card at this size — they ran together into one string — and
            // the saved-readings matrix below dates every one of them.
            Sparkline(values: history)
                .frame(height: 44)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(SerasonaSpace.s4)
        .background(tint)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(value.map { AssessmentRung.of($0).color } ?? SerasonaColor.borderHairline)
                .frame(height: 3)
        }
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.lg))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value.map { "\($0), \(ScoreBandLabel.of($0))" } ?? "not read")")
    }

    private var tint: Color {
        guard let value else { return SerasonaColor.surfaceRaised }
        return AssessmentRung.of(value).color.opacity(0.18)
    }
}

/// Left and bottom padding is wider than top and right so there's room for
/// a real Y axis and X axis rather than floating points.
private struct Sparkline: View {
    let values: [Int?]

    var body: some View {
        GeometryReader { geometry in
            let padLeft: CGFloat = 10
            let padBottom: CGFloat = 6
            let innerWidth = max(geometry.size.width - padLeft - 4, 1)
            let innerHeight = max(geometry.size.height - padBottom, 1)
            let step = values.count > 1 ? innerWidth / CGFloat(values.count - 1) : 0

            let points: [CGPoint?] = values.enumerated().map { index, value in
                guard let value else { return nil }
                return CGPoint(
                    x: padLeft + CGFloat(index) * step,
                    y: (1 - CGFloat(value) / 100) * innerHeight
                )
            }

            ZStack {
                Path { path in
                    path.move(to: CGPoint(x: padLeft, y: 0))
                    path.addLine(to: CGPoint(x: padLeft, y: innerHeight))
                    path.addLine(to: CGPoint(x: geometry.size.width, y: innerHeight))
                }
                .stroke(SerasonaColor.chartGrid, lineWidth: 1)

                Path { path in
                    var started = false
                    for point in points {
                        guard let point else { started = false; continue }
                        if started { path.addLine(to: point) } else { path.move(to: point); started = true }
                    }
                }
                .stroke(SerasonaColor.inkMuted, lineWidth: 1.5)

                ForEach(Array(points.enumerated()), id: \.offset) { index, point in
                    if let point, let value = values[index] {
                        Circle()
                            .fill(AssessmentRung.of(value).color)
                            .frame(width: 7, height: 7)
                            .position(point)
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }
}

private struct LabeledBlock: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s1) {
            Text(label)
                .serasonaStyle(SerasonaType.eyebrow)
                .foregroundStyle(SerasonaColor.inkMuted)
            Text(value)
                .serasonaStyle(SerasonaType.titleMD)
                .foregroundStyle(SerasonaColor.inkStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Weakest on the left, best on the right, the same direction as every
/// band scale in the product. The lit rung is always named, never only
/// colored.
private struct RungScale: View {
    let current: AssessmentRung

    var body: some View {
        HStack(spacing: SerasonaSpace.s1) {
            ForEach(AssessmentRung.allCases) { rung in
                Text(rung.label)
                    .serasonaStyle(SerasonaType.readoutSM)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                    .foregroundStyle(rung == current ? SerasonaColor.inkInverse : SerasonaColor.inkBody)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, SerasonaSpace.s2)
                    .background(
                        RoundedRectangle(cornerRadius: SerasonaRadius.sm)
                            .fill(rung == current ? rung.color : rung.color.opacity(0.16))
                    )
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Assessment: \(current.label), \(current.recommendation)")
    }
}

private struct RungLegend: View {
    var body: some View {
        HStack(spacing: SerasonaSpace.s3) {
            ForEach(AssessmentRung.allCases) { rung in
                HStack(spacing: SerasonaSpace.s1) {
                    Circle().fill(rung.color).frame(width: 8, height: 8)
                    Text(rung.label)
                        .serasonaStyle(SerasonaType.readoutSM)
                        .foregroundStyle(SerasonaColor.inkMuted)
                }
            }
        }
    }
}

private struct MatrixRow: Identifiable {
    let label: String
    let value: (CheckIn) -> Int?
    var id: String { label }

    static let all: [MatrixRow] = [
        MatrixRow(label: "Serasona") { CheckInHistoryMath.score($0) }
    ] + ScoreGroup.allCases.map { group in
        MatrixRow(label: group.label) { CheckInHistoryMath.index($0, group: group) }
    }
}

private struct MatrixCell: View {
    let value: Int?

    var body: some View {
        Text(value.map(String.init) ?? "—")
            .serasonaStyle(SerasonaType.readout)
            .monospacedDigit()
            .foregroundStyle(SerasonaColor.inkStrong)
            .frame(maxWidth: .infinity)
            .padding(.vertical, SerasonaSpace.s2)
            .background(
                RoundedRectangle(cornerRadius: SerasonaRadius.sm)
                    .fill(value.map { AssessmentRung.of($0).color.opacity(0.22) } ?? SerasonaColor.surfaceSunken)
            )
    }
}

private struct SessionRow: View {
    let checkIn: CheckIn

    var body: some View {
        HStack(spacing: SerasonaSpace.s3) {
            VStack(alignment: .leading, spacing: 2) {
                Text(DateText.long(checkIn.capturedAt))
                    .serasonaStyle(SerasonaType.body)
                    .foregroundStyle(SerasonaColor.inkStrong)
                Text(checkIn.model)
                    .serasonaStyle(SerasonaType.readoutSM)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }

            Spacer()

            if let score = CheckInHistoryMath.score(checkIn) {
                Text("\(score)")
                    .serasonaStyle(SerasonaType.readoutLG)
                    .monospacedDigit()
                    .foregroundStyle(SerasonaColor.inkStrong)
            } else {
                Text("No readable results")
                    .serasonaStyle(SerasonaType.caption)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }
        }
        .padding(.vertical, SerasonaSpace.s3)
        .accessibilityElement(children: .combine)
    }
}

private struct ProvenanceRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: SerasonaSpace.s3) {
            Text(label)
                .serasonaStyle(SerasonaType.readoutSM)
                .foregroundStyle(SerasonaColor.inkMuted)
                .frame(width: 128, alignment: .leading)
            Text(value)
                .serasonaStyle(SerasonaType.caption)
                .foregroundStyle(SerasonaColor.inkStrong)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Method sheet

private struct ScoreMethodSheet: View {
    let score: SerasonaScoreResult?
    let sleep: SleepScore.Result?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: SerasonaSpace.s5) {
                    Text("What the index means")
                        .serasonaStyle(SerasonaType.displaySM)
                        .foregroundStyle(SerasonaColor.inkStrong)

                    Text("Higher values mean fewer flagged signs in the returned model results. Serasona groups the model's returned sign bands into Stress, Wellness and Clarity. Inconclusive and missing signs never count as normal.")
                        .serasonaStyle(SerasonaType.body)
                        .foregroundStyle(SerasonaColor.inkBody)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("Score = sum of each readable sign's index × weight, divided by the total readable weight. Normal = 100, Low = 68, Moderate = 38, Elevated = 8. Repeated signs count once.")
                        .serasonaStyle(SerasonaType.bodySM)
                        .foregroundStyle(SerasonaColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("Compare the same source, model and scored signs. A change in coverage starts a separate comparison. Provider recommendations and individual flags remain visible even when the composite is high.")
                        .serasonaStyle(SerasonaType.bodySM)
                        .foregroundStyle(SerasonaColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)

                    if let score {
                        Divider().overlay(SerasonaColor.borderHairline)

                        Text("LATEST SCORE CONTRIBUTIONS")
                            .serasonaStyle(SerasonaType.eyebrow)
                            .foregroundStyle(SerasonaColor.inkMuted)

                        let readableWeight = score.signals.filter { $0.index != nil }.reduce(0.0) { $0 + $1.weight }

                        ForEach(score.signals) { signal in
                            HStack(alignment: .firstTextBaseline) {
                                Text(signal.label)
                                    .serasonaStyle(SerasonaType.bodySM)
                                    .foregroundStyle(SerasonaColor.inkStrong)
                                Spacer()
                                Text(signal.index.map { "\(Int($0))" } ?? "Unscored")
                                    .serasonaStyle(SerasonaType.readout)
                                    .foregroundStyle(SerasonaColor.inkMuted)
                                Text(
                                    signal.index == nil || readableWeight == 0
                                        ? "Excluded"
                                        : String(format: "%.1f%%", 100 * signal.weight / readableWeight)
                                )
                                .serasonaStyle(SerasonaType.readoutSM)
                                .foregroundStyle(SerasonaColor.inkMuted)
                                .frame(width: 70, alignment: .trailing)
                            }
                        }
                    }

                    if let sleep, let value = sleep.score {
                        Divider().overlay(SerasonaColor.borderHairline)
                        HStack {
                            Text("Sleep Score")
                                .serasonaStyle(SerasonaType.bodySM)
                                .foregroundStyle(SerasonaColor.inkStrong)
                            Spacer()
                            Text("\(value) · \(sleep.bandLabel ?? "")")
                                .serasonaStyle(SerasonaType.readout)
                                .foregroundStyle(SerasonaColor.inkMuted)
                        }
                        Text("Scored over the sleep-relevant signs only, with their own weights, so a rested night can show through a stressful day.")
                            .serasonaStyle(SerasonaType.caption)
                            .foregroundStyle(SerasonaColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(SerasonaSpace.s6)
            }
            .background(SerasonaColor.surfaceCanvas.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
