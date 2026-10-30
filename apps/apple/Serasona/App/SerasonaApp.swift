import SwiftUI

@main
struct SerasonaApp: App {
    init() {
        SerasonaFontRegistrar.registerAll()
        _ = FirebaseAuthService.shared // configures FirebaseApp and starts the auth-state listener
        SerasonaAPI.tokenProvider = FirebaseAuthTokenProvider()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(nil) // respect system Daylight/Dusk setting
        }
    }
}
