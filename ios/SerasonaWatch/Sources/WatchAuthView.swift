import SwiftUI

struct WatchAuthView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("Serasona")
                    .font(.headline)
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                SecureField("Password", text: $password)
                    .textContentType(.password)
                Button("Sign in") {
                    Task { await session.signIn(email: email, password: password) }
                }
                .disabled(email.isEmpty || password.count < 6 || session.isWorking)
                if let error = session.errorMessage {
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(.red)
                }
                Text("Sign up on the iPhone app first.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}
