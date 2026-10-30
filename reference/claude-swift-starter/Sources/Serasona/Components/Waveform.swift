import SwiftUI

/// A live amplitude readout, bars rising off a resting track.
/// Active bars use `Serasona.Waveform.active`; the resting track uses `.idle`.
struct SerasonaWaveform: View {
    var level: Float // 0...1
    var isActive: Bool
    private let barCount = 24

    var body: some View {
        GeometryReader { geo in
            let barWidth = geo.size.width / CGFloat(barCount * 2 - 1)
            HStack(spacing: barWidth) {
                ForEach(0..<barCount, id: \.self) { index in
                    let phase = sin(Double(index) * 0.7)
                    let magnitude = isActive ? max(0.08, CGFloat(level) * CGFloat(0.4 + 0.6 * abs(phase))) : 0.06
                    Capsule()
                        .fill(isActive ? Serasona.Waveform.active : Serasona.Waveform.idle)
                        .frame(width: barWidth, height: max(3, magnitude * geo.size.height))
                }
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .center)
            .animation(.easeOut(duration: 0.08), value: level)
        }
    }
}

#Preview {
    SerasonaWaveform(level: 0.6, isActive: true)
        .frame(height: 64)
        .padding()
        .background(Serasona.Surface.canvas)
}
