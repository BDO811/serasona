import SwiftUI

struct ProcessingView: View {
    @State private var pulse = false

    var body: some View {
        VStack(spacing: SerasonaSpace.s6) {
            Spacer()

            Circle()
                .stroke(SerasonaColor.ember, lineWidth: 3)
                .frame(width: 72, height: 72)
                .scaleEffect(pulse ? 1.15 : 0.9)
                .opacity(pulse ? 0.2 : 0.9)
                .animation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true), value: pulse)
                .onAppear { pulse = true }

            Text("Reading your voice…")
                .serasonaStyle(SerasonaType.titleMD)
                .foregroundStyle(SerasonaColor.inkStrong)

            Text("This usually takes under a minute.")
                .serasonaStyle(SerasonaType.bodySM)
                .foregroundStyle(SerasonaColor.inkMuted)

            Spacer()
        }
    }
}
