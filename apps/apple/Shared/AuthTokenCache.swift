import Foundation

/// Caches the signed-in Firebase ID token in the shared App Group container so
/// the watchOS targets — which do not link FirebaseAuth, since Firebase's
/// watchOS support doesn't cover a full standalone Auth session — can attach
/// it to their own requests instead of running their own sign-in. The iOS app
/// (`FirebaseAuthService`) is the only writer; the watch only ever reads.
enum AuthTokenCache {
    private static var defaults: UserDefaults {
        UserDefaults(suiteName: SharedStore.appGroupID) ?? .standard
    }

    private static let tokenKey = "serasona.auth.idToken"
    private static let expiryKey = "serasona.auth.idTokenExpiry"
    private static let uidKey = "serasona.auth.uid"

    static func store(token: String, expiresAt: Date, uid: String) {
        defaults.set(token, forKey: tokenKey)
        defaults.set(expiresAt.timeIntervalSince1970, forKey: expiryKey)
        defaults.set(uid, forKey: uidKey)
    }

    static func clear() {
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: expiryKey)
        defaults.removeObject(forKey: uidKey)
    }

    /// Nil once the cached token is within a minute of expiry. The watch has
    /// no refresh path of its own, so it's better to fail fast with "sign in
    /// on your phone" than to hand the server a token that's about to bounce.
    static var cachedToken: String? {
        guard let token = defaults.string(forKey: tokenKey) else { return nil }
        let expiry = defaults.double(forKey: expiryKey)
        guard expiry - Date().timeIntervalSince1970 > 60 else { return nil }
        return token
    }

    static var uid: String? { defaults.string(forKey: uidKey) }
}
