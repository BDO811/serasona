import SwiftUI

/// One row per `V2Signal`, banded and colored exactly as the web report does.
struct MetricTile: View {
    let signal: V2Signal

    private var band: DisplayBand { signal.band }

    var body: some View {
        HStack(spacing: SerasonaSpace.s4) {
            VStack(alignment: .leading, spacing: SerasonaSpace.s1) {
                Text(signal.displayName)
                    .serasonaStyle(SerasonaType.titleMD)
                    .foregroundStyle(SerasonaColor.inkStrong)

                Text("\(Int(signal.score * 100))% signal strength")
                    .serasonaStyle(SerasonaType.caption)
                    .foregroundStyle(SerasonaColor.inkMuted)
            }

            Spacer()

            Text(SignalBand.label(name: signal.name, band: band))
                .serasonaStyle(SerasonaType.label)
                .foregroundStyle(SignalBand.color(name: signal.name, band: band))
                .padding(.horizontal, SerasonaSpace.s3)
                .padding(.vertical, SerasonaSpace.s1)
                .background(SignalBand.softBackground(band))
                .clipShape(Capsule())
        }
        .padding(SerasonaSpace.s5)
        .background(SerasonaColor.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
    }
}
