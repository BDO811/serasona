import FirebaseAuth
import FirebaseCore
import FirebaseFirestore
import Foundation

/// Mirrors the web app's `SubscriptionState` (`AuthContext.tsx`) — written by
/// `stripe-webhook` for web purchases and `apple-iap-verify` for StoreKit
/// purchases, onto the same `users/{uid}.subscription` field either way.
struct SubscriptionState: Equatable {
    enum PlanId: String { case free, core, plus, executive }

    let planId: PlanId
    let status: String
    let currentPeriodEnd: Date?

    static let free = SubscriptionState(planId: .free, status: "none", currentPeriodEnd: nil)

    private static let planRank: [PlanId: Int] = [.free: 0, .core: 1, .plus: 2, .executive: 3]
    private static let activeStatuses: Set<String> = ["active", "trialing"]

    var isActive: Bool { Self.activeStatuses.contains(status) }

    /// Mirrors `AuthContext.isEntitled` — active on this plan or higher.
    func isEntitled(to plan: PlanId) -> Bool {
        isActive && (Self.planRank[planId] ?? 0) >= (Self.planRank[plan] ?? 0)
    }

    init(planId: PlanId, status: String, currentPeriodEnd: Date?) {
        self.planId = planId
        self.status = status
        self.currentPeriodEnd = currentPeriodEnd
    }

    init?(document data: [String: Any]?) {
        guard let raw = data?["subscription"] as? [String: Any] else { return nil }
        let planId = (raw["planId"] as? String).flatMap(PlanId.init(rawValue:)) ?? .free
        let status = raw["status"] as? String ?? "none"
        let periodEnd = (raw["currentPeriodEnd"] as? NSNumber)?.doubleValue
        self.init(planId: planId, status: status, currentPeriodEnd: periodEnd.map(Date.init(timeIntervalSince1970:)))
    }
}

/// Wraps Firebase Auth for the iOS app. Mirrors `Serasona_App/src/context/
/// AuthContext.tsx`'s `signUp` / `logIn` exactly — same email+password
/// project, same Firestore `users/{uid}` document shape — so an account
/// created here works on the web app and vice versa.
@MainActor
final class FirebaseAuthService: ObservableObject {
    static let shared = FirebaseAuthService()

    @Published private(set) var isSignedIn: Bool
    @Published private(set) var email: String?
    /// Nil while the first Firestore read is in flight; `.free` once it comes
    /// back with no `subscription` field at all (its absence already means
    /// free, same as the web app — see `AuthContext.tsx`).
    @Published private(set) var subscription: SubscriptionState?

    private var stateHandle: AuthStateDidChangeListenerHandle?
    private var subscriptionListener: ListenerRegistration?

    private init() {
        if FirebaseApp.app() == nil { FirebaseApp.configure() }
        isSignedIn = Auth.auth().currentUser != nil
        email = Auth.auth().currentUser?.email
        SerasonaIdentity.email = email
        if let user = Auth.auth().currentUser { listenForSubscription(uid: user.uid) }

        stateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                guard let self else { return }
                self.isSignedIn = user != nil
                self.email = user?.email
                SerasonaIdentity.email = user?.email
                if let user {
                    await self.cacheToken(for: user)
                    self.listenForSubscription(uid: user.uid)
                } else {
                    AuthTokenCache.clear()
                    self.subscriptionListener?.remove()
                    self.subscriptionListener = nil
                    self.subscription = nil
                }
            }
        }
    }

    private func listenForSubscription(uid: String) {
        subscriptionListener?.remove()
        subscriptionListener = Firestore.firestore().collection("users").document(uid)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    print("[FirebaseAuthService] subscription listener error: \(error.localizedDescription)")
                    return
                }
                self.subscription = SubscriptionState(document: snapshot?.data()) ?? .free
            }
    }

    func signUp(email: String, password: String) async throws {
        let result = try await Auth.auth().createUser(withEmail: email, password: password)
        try await result.user.sendEmailVerification()
        await cacheToken(for: result.user)
    }

    func logIn(email: String, password: String) async throws {
        let result = try await Auth.auth().signIn(withEmail: email, password: password)
        await cacheToken(for: result.user)
    }

    func logOut() throws {
        try Auth.auth().signOut()
        AuthTokenCache.clear()
    }

    /// Permanently deletes the account and everything attached to it.
    ///
    /// App Store Guideline 5.1.1(v): an app that creates accounts has to let
    /// someone delete theirs from inside the app, not by emailing support.
    ///
    /// Order matters. The saved check-ins and the `users/{uid}` document are
    /// removed while the credential is still valid, because once the auth
    /// user is gone there is no token left to authorize either call. Firebase
    /// requires a recent sign-in before `delete()`, so the password is taken
    /// again at the point of deletion rather than trusted from the session.
    ///
    /// Throws if erasing readings fails, before removing the auth account.
    @discardableResult
    func deleteAccount(password: String) async throws -> Bool {
        guard let user = Auth.auth().currentUser, let email = user.email else {
            throw SerasonaAPIError.notSignedIn
        }

        let credential = EmailAuthProvider.credential(withEmail: email, password: password)
        try await user.reauthenticate(with: credential)

        let historyDeleted = try await SerasonaAPI.deleteHistory()
        try await Firestore.firestore().collection("users").document(user.uid).delete()

        subscriptionListener?.remove()
        subscriptionListener = nil

        try await user.delete()

        AuthTokenCache.clear()
        SharedStore.clear()
        CheckInReminders.disable()
        SerasonaIdentity.email = nil

        return historyDeleted
    }

    /// Mints a fresh ID token and writes it to the shared App Group so the
    /// watch can use it too (see `AuthTokenCache`).
    @discardableResult
    private func cacheToken(for user: User) async -> Bool {
        guard let result = try? await user.getIDTokenResult(forcingRefresh: true) else { return false }
        AuthTokenCache.store(token: result.token, expiresAt: result.expirationDate, uid: user.uid)
        return true
    }
}

/// Live token source for every `SerasonaAPI` call made from the phone.
struct FirebaseAuthTokenProvider: SerasonaAuthTokenProviding {
    func idToken() async throws -> String {
        guard let user = Auth.auth().currentUser else { throw SerasonaAPIError.notSignedIn }
        let result = try await user.getIDTokenResult(forcingRefresh: false)
        AuthTokenCache.store(token: result.token, expiresAt: result.expirationDate, uid: user.uid)
        return result.token
    }
}

/// Maps Firebase's `NSError` auth codes to copy a person can act on, instead
/// of raw strings like "ERROR_WEAK_PASSWORD".
enum FirebaseAuthErrorMessage {
    static func from(_ error: Error) -> String {
        guard let code = AuthErrorCode(rawValue: (error as NSError).code) else {
            return error.localizedDescription
        }
        switch code {
        case .invalidEmail: return "That doesn't look like a valid email."
        case .emailAlreadyInUse: return "An account already exists for that email. Try logging in instead."
        case .weakPassword: return "Choose a password with at least 6 characters."
        case .wrongPassword, .invalidCredential: return "Incorrect email or password."
        case .userNotFound: return "No account found for that email."
        case .userDisabled: return "This account has been disabled."
        case .networkError: return "Couldn't reach Serasona. Check your connection."
        case .tooManyRequests: return "Too many attempts. Try again in a few minutes."
        default: return error.localizedDescription
        }
    }
}
