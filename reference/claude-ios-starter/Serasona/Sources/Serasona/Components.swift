import SwiftUI

struct BandPill: View {
    let band: Band
    var body: some View {
        Text(band.rawValue)
            .font(SerasonaType.label)
            .foregroundColor(Color.forBand(band))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color.softForBand(band))
            .clipShape(Capsule())
    }
}

struct MetricCard: View {
    let metric: Metric

    var deltaText: String {
        metric.delta > 0 ? "+\(metric.delta)" : "\(metric.delta)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(metric.name.uppercased())
                .font(SerasonaType.eyebrow)
                .tracking(1.2)
                .foregroundColor(.inkMuted)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(metric.value)")
                    .font(SerasonaType.score(32))
                    .foregroundColor(.inkStrong)
                Text(deltaText)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(metric.delta >= 0 ? .tide : .stateWatch)
            }
            BandPill(band: metric.band)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl, style: .continuous))
        .shadow(color: .black.opacity(0.06), radius: 10, y: 4)
    }
}

struct ScoreDial: View {
    let score: Int
    let band: Band
    var size: CGFloat = 176

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.surfaceSunken, lineWidth: 12)
            Circle()
                .trim(from: 0, to: CGFloat(score) / 100)
                .stroke(Color.forBand(band), style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("\(score)")
                    .font(SerasonaType.score(64))
                    .foregroundColor(.inkStrong)
                BandPill(band: band)
            }
        }
        .frame(width: size, height: size)
    }
}

struct WaveformBars: View {
    let active: Bool
    @State private var phase: CGFloat = 0
    private let barCount = 24

    var body: some View {
        TimelineView(.animation) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            HStack(spacing: 4) {
                ForEach(0..<barCount, id: \.self) { i in
                    let h: CGFloat = active
                        ? 8 + 40 * CGFloat((sin(t * 6 + Double(i) * 0.7) + 1) / 2)
                        : 6
                    Capsule()
                        .fill(active ? Color.ember : Color.waveformIdle)
                        .frame(width: 4, height: h)
                }
            }
            .animation(.linear(duration: 0.1), value: active)
        }
    }
}
