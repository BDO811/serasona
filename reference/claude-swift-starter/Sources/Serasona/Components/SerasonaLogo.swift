import SwiftUI

/// The Serasona logo is the full lockup: the lowercase "serasona" wordmark beside the
/// band-and-arc graphic. The wordmark stays live Bricolage Grotesque type; only the bands
/// are a shipped raster (SerasonaBands-light / SerasonaBands-dark), matching the design
/// system's own asset split. Never recolor the bands or reset the wordmark's tracking.
struct SerasonaLogo: View {
    var height: CGFloat = 20
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        HStack(spacing: height * 0.5) {
            Text("serasona")
                .font(.custom("BricolageGrotesque-SemiBold", size: height * 1.85))
                .tracking(-0.4)
                .foregroundStyle(colorScheme == .dark ? Serasona.Ink.inverse : Serasona.Ink.strong)

            Image(colorScheme == .dark ? "SerasonaBands-dark" : "SerasonaBands-light", bundle: .module)
                .resizable()
                .scaledToFit()
                .frame(height: height)
        }
        .fixedSize()
        .accessibilityLabel("Serasona")
    }
}

#Preview {
    VStack(spacing: 24) {
        SerasonaLogo(height: 22)
    }
    .padding(40)
    .background(Serasona.Surface.canvas)
}
