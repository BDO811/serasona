import SwiftUI

struct WatchSignInView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var working = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Serasona").serasonaStyle(SerasonaType.titleMD)
                Text("Sign in to your Serasona account. Your Watch works over Wi-Fi or cellular without your iPhone nearby.")
                    .font(.footnote).fixedSize(horizontal: false, vertical: true)
                TextField("Email", text: $email,
                    prompt: Text("Email").foregroundColor(SerasonaColor.inkMuted))
                    .foregroundColor(SerasonaColor.inkStrong)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                SecureField("Password", text: $password,
                    prompt: Text("Password").foregroundColor(SerasonaColor.inkMuted))
                    .foregroundColor(SerasonaColor.inkStrong)
                    .textContentType(.password)
                if let error { Text(error).font(.footnote).foregroundStyle(SerasonaColor.stateStrained) }
                Button {
                    working = true
                    error = nil
                    Task {
                        defer { working = false; password = "" }
                        do { try await WatchAuthService.shared.logIn(email: email, password: password) }
                        catch { self.error = error.localizedDescription }
                    }
                } label: {
                    if working { ProgressView() } else { Text("Sign in") }
                }
                .disabled(working || email.isEmpty || password.isEmpty)
                Text("Create an account or reset your password at serasona.com.").font(.footnote)
                Text("Wellness insights only. Not a diagnosis or medical advice.").font(.footnote)
                Link("Privacy policy", destination: SerasonaLegal.privacy)
                Link("Terms", destination: SerasonaLegal.terms)
            }
            .foregroundStyle(SerasonaColor.inkBody)
            .padding(8)
        }
        .tint(SerasonaColor.ember)
    }
}
