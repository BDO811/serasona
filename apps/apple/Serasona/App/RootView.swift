import SwiftUI

struct RootView: View {
    @ObservedObject private var auth = FirebaseAuthService.shared

    var body: some View {
        #if DEBUG
        if let screen = UIHarness.requested {
            UIHarnessView(screen: screen)
        } else if auth.isSignedIn {
            MainTabView()
        } else {
            OnboardingView()
        }
        #else
        if auth.isSignedIn {
            MainTabView()
        } else {
            OnboardingView()
        }
        #endif
    }
}

struct MainTabView: View {
    enum Tab: Hashable { case dashboard, checkIn, history, settings }
    @State private var selection: Tab
    @State private var captureID = UUID()
    var injectedDashboardHistory: [CheckIn]?

    init(initialSelection: Tab = .dashboard, injectedDashboardHistory: [CheckIn]? = nil) {
        _selection = State(initialValue: initialSelection)
        self.injectedDashboardHistory = injectedDashboardHistory
    }

    var body: some View {
        TabView(selection: $selection) {
            DashboardHomeView(onRecord: {
                captureID = UUID()
                selection = .checkIn
            }, injectedHistory: injectedDashboardHistory)
                .tabItem { Label("Dashboard", systemImage: "square.grid.2x2") }
                .tag(Tab.dashboard)

            CaptureFlowView()
                .id(captureID)
                .tabItem { Label("Check In", image: "mic") }
                .tag(Tab.checkIn)

            HistoryView()
                .tabItem { Label("History", image: "history") }
                .tag(Tab.history)

            SettingsView()
                .tabItem { Label("Settings", image: "sliders") }
                .tag(Tab.settings)
        }
        .tint(SerasonaColor.ember)
    }
}
