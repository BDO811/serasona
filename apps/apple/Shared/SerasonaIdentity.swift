import Foundation

/// A display-only cache of the signed-in identity's email, kept in sync by
/// `FirebaseAuthService`'s auth-state listener. The real identity for every
/// gated API call is the Firebase ID token in `SerasonaAPI.tokenProvider` —
/// `analyzeAudio` has no anonymous path at all, and `voiceHistory`'s anonymous
/// mode is the original public try-it demo, not the real signed-in product.
enum SerasonaIdentity {
    private static let emailKey = "serasona.identity.email"

    static var email: String? {
        get { UserDefaults.standard.string(forKey: emailKey) }
        set { UserDefaults.standard.set(newValue, forKey: emailKey) }
    }

    static var hasIdentity: Bool { (email?.isEmpty == false) }
}
