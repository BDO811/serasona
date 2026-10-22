import Foundation
import SerasonaKit

/// App-wide auth state, observable by SwiftUI. Wraps `FirebaseAuthClient`
/// (an actor) so views can bind to `@Published var session` directly instead
/// of awaiting the actor on every read.
@MainActor
final class SessionManager: ObservableObject {
    @Published private(set) var session: AuthSession?
    @Published var errorMessage: String?
    @Published var isWorking = false

    let auth: FirebaseAuthClient
    let history = VoiceHistoryClient()
    let analyzer = AnalyzeAudioClient()

    init(keychainService: String) {
        let store = KeychainSessionStore(service: keychainService)
        self.auth = FirebaseAuthClient(store: store)
        Task { [weak self] in
            guard let self else { return }
            let current = await self.auth.currentSession
            await MainActor.run { self.session = current }
        }
    }

    func signIn(email: String, password: String) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            session = try await auth.signIn(email: email, password: password)
        } catch {
            errorMessage = (error as? SerasonaError)?.errorDescription ?? error.localizedDescription
        }
    }

    func signUp(email: String, password: String) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            session = try await auth.signUp(email: email, password: password)
        } catch {
            errorMessage = (error as? SerasonaError)?.errorDescription ?? error.localizedDescription
        }
    }

    func signOut() {
        session = nil
        Task { await auth.signOut() }
    }

    /// A valid (auto-refreshed if needed) bearer token for the Cloud Function
    /// calls, or nil if signed out — callers should route to the sign-in
    /// screen rather than surface a raw "not signed in" error in that case.
    func validIdToken() async -> String? {
        try? await auth.validIdToken()
    }
}
