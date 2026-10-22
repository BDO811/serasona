import SwiftUI

@main
struct SerasonaWatchApp: App {
    @StateObject private var session = SessionManager(keychainService: "com.amplifierhealth.serasona.watchkitapp")

    var body: some Scene {
        WindowGroup {
            WatchRootView()
                .environmentObject(session)
        }
    }
}
