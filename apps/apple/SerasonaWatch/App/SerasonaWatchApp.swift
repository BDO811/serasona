import SwiftUI

@main
struct SerasonaWatchApp: App {
    init() {
        SerasonaFontRegistrar.registerAll()
        SerasonaAPI.tokenProvider = WatchAuthService.shared
    }

    var body: some Scene {
        WindowGroup {
            WatchAppRoot()
        }
    }
}

private struct WatchAppRoot: View {
    @ObservedObject private var auth = WatchAuthService.shared
    var body: some View {
        ZStack {
            SerasonaColor.surfaceCanvas.ignoresSafeArea()
            if auth.isSignedIn { WatchRootView() } else { WatchSignInView() }
        }
        .tint(SerasonaColor.ember)
    }
}
