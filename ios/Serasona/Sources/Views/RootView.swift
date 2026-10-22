import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionManager

    var body: some View {
        Group {
            if session.session != nil {
                MainTabView()
            } else {
                AuthView()
            }
        }
        .animation(.default, value: session.session != nil)
    }
}
