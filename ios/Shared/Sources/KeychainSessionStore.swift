import Foundation
import Security
import SerasonaKit

/// Persists the signed-in `AuthSession` in the Keychain rather than
/// UserDefaults, since it carries a refresh token. Shared verbatim between
/// the iOS app and the watchOS app (each keeps its own item — the two are
/// signed in independently, see ios/README.md).
final class KeychainSessionStore: SessionStore, @unchecked Sendable {
    private let service: String
    private let account = "serasona.session"

    init(service: String) {
        self.service = service
    }

    func load() -> AuthSession? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = withUnsafeMutablePointer(to: &result) { ptr in
            SecItemCopyMatching(query as CFDictionary, ptr)
        }
        query.removeValue(forKey: kSecReturnData as String)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(AuthSession.self, from: data)
    }

    func save(_ session: AuthSession?) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)

        guard let session, let data = try? JSONEncoder().encode(session) else { return }
        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(addQuery as CFDictionary, nil)
    }
}
