import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            CheckinView()
                .tabItem { Label("Check-in", systemImage: "waveform") }

            HistoryView()
                .tabItem { Label("History", systemImage: "chart.line.uptrend.xyaxis") }

            AccountView()
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}
