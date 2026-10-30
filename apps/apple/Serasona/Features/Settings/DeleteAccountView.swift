import SwiftUI

/// In-app account deletion, required by App Store Guideline 5.1.1(v) for any
/// app that lets someone create an account.
///
/// The password is asked for again here rather than carried from the session,
/// because Firebase refuses `user.delete()` without a recent sign-in, and
/// because deleting an account is worth one deliberate step. Nothing is
/// deleted until the second screen is confirmed.
struct DeleteAccountView: View {
    let onDismiss: () -> Void

    @ObservedObject private var auth = FirebaseAuthService.shared
    @State private var password = ""
    @State private var confirming = false
    @State private var working = false
    @State private var error: String?
    @FocusState private var passwordFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                SerasonaColor.surfaceCanvas.ignoresSafeArea()

                VStack(alignment: .leading, spacing: SerasonaSpace.s5) {
                    Text(confirming ? "This cannot be undone." : "Delete your account")
                        .serasonaStyle(SerasonaType.displaySM)
                        .foregroundStyle(SerasonaColor.inkStrong)

                    Text(bodyCopy)
                        .serasonaStyle(SerasonaType.body)
                        .foregroundStyle(SerasonaColor.inkBody)
                        .fixedSize(horizontal: false, vertical: true)

                    if !confirming {
                        VStack(alignment: .leading, spacing: SerasonaSpace.s2) {
                            Text("CONFIRM YOUR PASSWORD")
                                .serasonaStyle(SerasonaType.eyebrow)
                                .foregroundStyle(SerasonaColor.inkMuted)

                            SecureField("Password", text: $password)
                                .textContentType(.password)
                                .focused($passwordFocused)
                                .serasonaStyle(SerasonaType.body)
                                .foregroundStyle(SerasonaColor.inkStrong)
                                .padding(SerasonaSpace.s3)
                                .background(
                                    RoundedRectangle(cornerRadius: SerasonaRadius.md)
                                        .fill(SerasonaColor.surfaceRaised)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: SerasonaRadius.md)
                                        .stroke(SerasonaColor.borderHairline, lineWidth: 1)
                                )
                        }
                    }

                    if let error {
                        Text(error)
                            .serasonaStyle(SerasonaType.caption)
                            .foregroundStyle(SerasonaColor.stateStrained)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer()

                    Button(action: primaryAction) {
                        HStack(spacing: SerasonaSpace.s2) {
                            if working { ProgressView().tint(SerasonaColor.inkOnEmber) }
                            Text(confirming ? "Delete my account" : "Continue")
                                .serasonaStyle(SerasonaType.label)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, SerasonaSpace.s4)
                        .background(
                            Capsule().fill(
                                confirming ? SerasonaColor.stateStrained : SerasonaColor.ember
                            )
                        )
                        .foregroundStyle(SerasonaColor.inkOnEmber)
                    }
                    .disabled(working || (!confirming && password.isEmpty))
                    .opacity(working || (!confirming && password.isEmpty) ? 0.5 : 1)

                    Button("Keep my account", action: onDismiss)
                        .serasonaStyle(SerasonaType.label)
                        .foregroundStyle(SerasonaColor.tide)
                        .frame(maxWidth: .infinity)
                        .disabled(working)
                }
                .padding(SerasonaSpace.s6)
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear { passwordFocused = true }
    }

    private var bodyCopy: String {
        if confirming {
            return """
            Deleting removes your sign-in, your plan, and every check-in you've \
            saved. Nothing is recoverable afterwards, on the phone, the watch, \
            or the web.

            An active subscription is billed by Apple, not by us. Cancel it in \
            iOS Settings under your Apple Account if you haven't already.
            """
        }
        return """
        This removes \(auth.email ?? "your account") and every reading saved \
        against it. Confirm your password to continue.
        """
    }

    private func primaryAction() {
        error = nil
        guard confirming else {
            confirming = true
            passwordFocused = false
            return
        }
        working = true
        Task {
            do {
                try await auth.deleteAccount(password: password)
                working = false
                onDismiss()
            } catch {
                working = false
                confirming = false
                self.error = FirebaseAuthErrorMessage.from(error)
            }
        }
    }
}
