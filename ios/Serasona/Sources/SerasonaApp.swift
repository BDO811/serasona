import SwiftUI

@main
struct SerasonaApp: App {
    @StateObject private var session = SessionManager(keychainService: "com.amplifierhealth.serasona")

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
    }
}
