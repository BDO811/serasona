import SwiftUI

struct SettingsView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Serasona.Space.s6) {
                    SerasonaLogo(height: 18)
                        .padding(.top, Serasona.Space.s2)

                    SerasonaCard {
                        Text("ABOUT").serasonaEyebrowStyle()
                        Text("Serasona reads stress, mood, energy, confidence, mental fatigue, alertness and focus from a short voice check-in.")
                            .font(.serasonaBody)
                            .foregroundStyle(Serasona.Ink.body)
                    }

                    SerasonaCard {
                        Text("PRIVACY").serasonaEyebrowStyle()
                        Text("Recordings stay on this device until you choose to analyze them.")
                            .font(.serasonaBody)
                            .foregroundStyle(Serasona.Ink.body)
                    }
                }
                .padding(Serasona.Space.s4)
            }
            .background(Serasona.Surface.canvas)
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    SettingsView()
}
