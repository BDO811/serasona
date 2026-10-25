import SwiftUI

struct WatchRootView: View {
    @EnvironmentObject private var session: SessionManager

    var body: some View {
        if session.session != nil {
            WatchCheckinView()
        } else {
            WatchAuthView()
        }
    }
}
