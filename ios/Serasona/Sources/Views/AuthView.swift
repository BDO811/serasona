import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var session: SessionManager
    @State private var email = ""
    @State private var password = ""
    @State private var isSigningUp = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    Text("Serasona")
                        .font(.system(size: 34, weight: .semibold, design: .serif))
                    Text("Your voice, read daily.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 48)

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding()
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))

                    SecureField("Password", text: $password)
                        .textContentType(isSigningUp ? .newPassword : .password)
                        .padding()
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal)

                if let error = session.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Button {
                    Task {
                        if isSigningUp {
                            await session.signUp(email: email, password: password)
                        } else {
                            await session.signIn(email: email, password: password)
                        }
                    }
                } label: {
                    if session.isWorking {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text(isSigningUp ? "Create account" : "Sign in")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(email.isEmpty || password.count < 6 || session.isWorking)
                .padding(.horizontal)

                Button(isSigningUp ? "Already have an account? Sign in" : "New to Serasona? Create an account") {
                    isSigningUp.toggle()
                    session.errorMessage = nil
                }
                .font(.footnote)

                Spacer()
            }
        }
    }
}
