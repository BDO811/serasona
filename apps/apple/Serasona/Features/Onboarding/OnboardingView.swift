import SwiftUI

struct OnboardingView: View {
    private enum Mode { case signUp, logIn }

    @State private var mode: Mode = .signUp
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }

    var body: some View {
        ZStack {
            SerasonaColor.surfaceCanvas.ignoresSafeArea()

            VStack(alignment: .leading, spacing: SerasonaSpace.s8) {
                Spacer()

                Image("serasonaLogoBands")
                    .renderingMode(.original)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 64, height: 64)

                Text("Hear how you are")
                    .serasonaStyle(SerasonaType.displayLG)
                    .foregroundStyle(SerasonaColor.inkStrong)

                Text("A short voice check-in, a few times a week, becomes your own 30-day baseline — energy, stress, mood and more, read from how you sound rather than how you say you feel.")
                    .serasonaStyle(SerasonaType.bodyLG)
                    .foregroundStyle(SerasonaColor.inkBody)

                VStack(alignment: .leading, spacing: SerasonaSpace.s4) {
                    field(title: "EMAIL", placeholder: "you@example.com", text: $email, field: .email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)

                    field(title: "PASSWORD", placeholder: "At least 6 characters", text: $password, field: .password, isSecure: true)
                        .textContentType(mode == .signUp ? .newPassword : .password)
                        .onSubmit { Task { await submit() } }
                }
                .padding(.top, SerasonaSpace.s4)

                if let errorMessage {
                    Text(errorMessage)
                        .serasonaStyle(SerasonaType.caption)
                        .foregroundStyle(SerasonaColor.stateStrained)
                }

                Spacer()

                Button(action: { Task { await submit() } }) {
                    ZStack {
                        Text(mode == .signUp ? "Get started" : "Log in")
                            .serasonaStyle(SerasonaType.label)
                            .opacity(isSubmitting ? 0 : 1)
                        if isSubmitting {
                            ProgressView().tint(SerasonaColor.inkOnEmber)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, SerasonaSpace.s4)
                    .foregroundStyle(SerasonaColor.inkOnEmber)
                    .background(SerasonaColor.ember)
                    .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.lg))
                }
                .disabled(!isValid || isSubmitting)
                .opacity(isValid ? 1 : 0.38)

                Button(action: toggleMode) {
                    Text(mode == .signUp ? "Already have an account? Log in" : "New here? Get started")
                        .serasonaStyle(SerasonaType.caption)
                        .foregroundStyle(SerasonaColor.tide)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(SerasonaSpace.s6)
        }
    }

    @ViewBuilder
    private func field(title: String, placeholder: String, text: Binding<String>, field: Field, isSecure: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
            Text(title)
                .serasonaStyle(SerasonaType.eyebrow)
                .foregroundStyle(SerasonaColor.inkMuted)

            Group {
                if isSecure {
                    SecureField(placeholder, text: text)
                } else {
                    TextField(placeholder, text: text)
                }
            }
            .serasonaStyle(SerasonaType.body)
            .foregroundStyle(SerasonaColor.inkStrong)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .focused($focusedField, equals: field)
            .padding(SerasonaSpace.s4)
            .background(SerasonaColor.surfaceRaised)
            .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: SerasonaRadius.md)
                    .stroke(SerasonaColor.borderStrong, lineWidth: 1)
            )
        }
    }

    private var isValid: Bool {
        email.contains("@") && email.contains(".") && email.count > 5 && password.count >= 6
    }

    private func toggleMode() {
        mode = mode == .signUp ? .logIn : .signUp
        errorMessage = nil
    }

    private func submit() async {
        guard isValid, !isSubmitting else { return }
        isSubmitting = true
        errorMessage = nil
        focusedField = nil
        do {
            let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            switch mode {
            case .signUp: try await FirebaseAuthService.shared.signUp(email: normalizedEmail, password: password)
            case .logIn: try await FirebaseAuthService.shared.logIn(email: normalizedEmail, password: password)
            }
            // RootView swaps to MainTabView automatically once `isSignedIn` flips.
        } catch {
            errorMessage = FirebaseAuthErrorMessage.from(error)
        }
        isSubmitting = false
    }
}
