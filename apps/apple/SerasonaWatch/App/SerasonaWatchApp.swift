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
            // watchOS renders its status clock in white. Keep that small
            // system area legible while preserving the cream app surface.
            VStack(spacing: 0) {
                Color.black.frame(height: 36)
                Spacer(minLength: 0)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)
            if auth.isSignedIn { WatchRootView() } else { WatchSignInView() }
        }
        .tint(SerasonaColor.ember)
    }
}
