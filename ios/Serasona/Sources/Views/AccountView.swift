import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var session: SessionManager

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let email = session.session?.email {
                        LabeledContent("Email", value: email)
                    }
                }
                Section {
                    Button("Sign out", role: .destructive) {
                        session.signOut()
                    }
                }
            }
            .navigationTitle("Account")
        }
    }
}
