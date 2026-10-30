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
    var body: some View {
        TabView {
            CaptureFlowView()
                .tabItem { Label("Check In", image: "mic") }

            HistoryView()
                .tabItem { Label("History", image: "history") }

            SettingsView()
                .tabItem { Label("Settings", image: "sliders") }
        }
        .tint(SerasonaColor.ember)
    }
}
